import Foundation
import CryptoKit

/// Verifies minisign signatures (https://jedisct1.github.io/minisign/) using
/// CryptoKit Ed25519 + the vendored BLAKE2b, so update artifacts can be checked
/// against the project's embedded public key with no bundled tools.
enum Minisign {
    /// The Mouseflare release public key (repo: minisign.pub).
    static let mouseflarePublicKey = "RWQV1L6pDRSw69B18smY6ny2RZpAecKvPvS48ImhiukQjEmN8lAqP3Mw"

    enum VerifyError: Error, LocalizedError {
        case malformedKey
        case malformedSignature
        case keyMismatch
        case unsupportedAlgorithm
        case signatureInvalid
        case trustedCommentInvalid

        var errorDescription: String? {
            switch self {
            case .malformedKey: return "The public key is malformed."
            case .malformedSignature: return "The signature file is malformed."
            case .keyMismatch: return "The signature was made with a different key."
            case .unsupportedAlgorithm: return "Unsupported minisign algorithm."
            case .signatureInvalid: return "Signature verification failed."
            case .trustedCommentInvalid: return "The trusted comment's signature is invalid."
            }
        }
    }

    /// Verifies `data` against the contents of a `.minisig` file.
    /// Returns the trusted comment on success; throws on any failure.
    @discardableResult
    static func verify(data: Data, signatureFile: String, publicKey: String = mouseflarePublicKey) throws -> String {
        // Public key: base64(2-byte alg "Ed" || 8-byte key id || 32-byte Ed25519 key)
        guard let keyBlob = Data(base64Encoded: publicKey), keyBlob.count == 42,
              keyBlob.prefix(2) == Data("Ed".utf8) else {
            throw VerifyError.malformedKey
        }
        let keyId = keyBlob.subdata(in: 2..<10)
        let rawKey = keyBlob.subdata(in: 10..<42)
        let signingKey = try Curve25519.Signing.PublicKey(rawRepresentation: rawKey)

        // Signature file:
        //   line 1: untrusted comment: ...
        //   line 2: base64(2-byte alg || 8-byte key id || 64-byte signature)
        //   line 3: trusted comment: ...
        //   line 4: base64(64-byte global signature over sig || trusted comment)
        let lines = signatureFile
            .split(separator: "\n", omittingEmptySubsequences: false)
            .map(String.init)
        guard lines.count >= 4,
              let sigBlob = Data(base64Encoded: lines[1]), sigBlob.count == 74,
              let globalSig = Data(base64Encoded: lines[3]), globalSig.count == 64 else {
            throw VerifyError.malformedSignature
        }

        let algorithm = sigBlob.prefix(2)
        guard sigBlob.subdata(in: 2..<10) == keyId else { throw VerifyError.keyMismatch }
        let signature = sigBlob.subdata(in: 10..<74)

        // "ED" = prehashed (message is BLAKE2b-512 of the file — minisign's
        // default since 0.8, and what our CI produces); "Ed" = legacy raw.
        let message: Data
        if algorithm == Data("ED".utf8) {
            message = Blake2b.hash512(data)
        } else if algorithm == Data("Ed".utf8) {
            message = data
        } else {
            throw VerifyError.unsupportedAlgorithm
        }

        guard signingKey.isValidSignature(signature, for: message) else {
            throw VerifyError.signatureInvalid
        }

        // Global signature covers (signature || trusted comment) and binds the
        // human-readable comment to the artifact signature.
        let trustedPrefix = "trusted comment: "
        guard lines[2].hasPrefix(trustedPrefix) else { throw VerifyError.malformedSignature }
        let trustedComment = String(lines[2].dropFirst(trustedPrefix.count))
        let globalMessage = signature + Data(trustedComment.utf8)
        guard signingKey.isValidSignature(globalSig, for: globalMessage) else {
            throw VerifyError.trustedCommentInvalid
        }

        return trustedComment
    }
}
