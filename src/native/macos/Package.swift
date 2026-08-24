// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Mouseflare",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "Mouseflare", targets: ["Mouseflare"])
    ],
    targets: [
        .executableTarget(
            name: "Mouseflare",
            path: "Sources",
            resources: [
                .copy("Resources/app-logo.png")
            ]
        )
    ]
);
