using System;
using System.Linq;
using System.Text;

namespace Mouseflare.Core
{
    /// <summary>
    /// Verifies minisign signatures (https://jedisct1.github.io/minisign/)
    /// using the vendored Ed25519 + BLAKE2b, so update artifacts can be checked
    /// against the project's embedded public key with no bundled tools.
    /// (Mirrors src/native/macos/Sources/Minisign.swift.)
    /// </summary>
    public static class MinisignVerifier
    {
        /// <summary>The Mouseflare release public key (repo: minisign.pub).</summary>
        public const string MouseflarePublicKey = "RWQV1L6pDRSw69B18smY6ny2RZpAecKvPvS48ImhiukQjEmN8lAqP3Mw";

        public sealed class VerifyException : Exception
        {
            public VerifyException(string message) : base(message) { }
        }

        /// <summary>
        /// Verifies data against the contents of a .minisig file.
        /// Returns the trusted comment on success; throws VerifyException on failure.
        /// </summary>
        public static string Verify(byte[] data, string signatureFile, string publicKey = MouseflarePublicKey)
        {
            // Public key: base64(2-byte alg "Ed" || 8-byte key id || 32-byte Ed25519 key)
            byte[] keyBlob;
            try { keyBlob = Convert.FromBase64String(publicKey); }
            catch (FormatException) { throw new VerifyException("The public key is malformed."); }
            if (keyBlob.Length != 42 || keyBlob[0] != (byte)'E' || keyBlob[1] != (byte)'d')
                throw new VerifyException("The public key is malformed.");
            byte[] keyId = keyBlob.Skip(2).Take(8).ToArray();
            byte[] rawKey = keyBlob.Skip(10).Take(32).ToArray();

            // Signature file:
            //   line 1: untrusted comment: ...
            //   line 2: base64(2-byte alg || 8-byte key id || 64-byte signature)
            //   line 3: trusted comment: ...
            //   line 4: base64(64-byte global signature over sig || trusted comment)
            string[] lines = signatureFile.Replace("\r\n", "\n").Split('\n');
            if (lines.Length < 4) throw new VerifyException("The signature file is malformed.");

            byte[] sigBlob, globalSig;
            try
            {
                sigBlob = Convert.FromBase64String(lines[1]);
                globalSig = Convert.FromBase64String(lines[3]);
            }
            catch (FormatException) { throw new VerifyException("The signature file is malformed."); }
            if (sigBlob.Length != 74 || globalSig.Length != 64)
                throw new VerifyException("The signature file is malformed.");

            if (!sigBlob.Skip(2).Take(8).SequenceEqual(keyId))
                throw new VerifyException("The signature was made with a different key.");
            byte[] signature = sigBlob.Skip(10).Take(64).ToArray();

            // "ED" = prehashed (message is BLAKE2b-512 of the file — minisign's
            // default since 0.8, and what our CI produces); "Ed" = legacy raw.
            byte[] message;
            if (sigBlob[0] == (byte)'E' && sigBlob[1] == (byte)'D')
                message = Blake2b.Hash512(data);
            else if (sigBlob[0] == (byte)'E' && sigBlob[1] == (byte)'d')
                message = data;
            else
                throw new VerifyException("Unsupported minisign algorithm.");

            if (!Ed25519.Verify(signature, message, rawKey))
                throw new VerifyException("Signature verification failed.");

            // Global signature binds the trusted comment to the artifact signature
            const string trustedPrefix = "trusted comment: ";
            if (!lines[2].StartsWith(trustedPrefix, StringComparison.Ordinal))
                throw new VerifyException("The signature file is malformed.");
            string trustedComment = lines[2].Substring(trustedPrefix.Length);
            byte[] globalMessage = signature.Concat(Encoding.UTF8.GetBytes(trustedComment)).ToArray();
            if (!Ed25519.Verify(globalSig, globalMessage, rawKey))
                throw new VerifyException("The trusted comment's signature is invalid.");

            return trustedComment;
        }
    }
}
