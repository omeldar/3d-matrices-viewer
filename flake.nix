{
  description = "Dev environment for a v0.dev project using Next.js, Three.js, and TypeScript";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };
      in {
        devShells.default = pkgs.mkShell {
          name = "v0dev-project-env";

          packages = with pkgs; [
            nodejs_20             # LTS Node.js
            yarn                  # or choose npm if preferred
            git
            openssl
            pkg-config
            python3               # needed for some node packages
            glibcLocales          # locale support for node tools
          ];

          shellHook = ''
            export NODE_OPTIONS="--openssl-legacy-provider"
            echo "Dev environment for v0.dev project ready!"
            echo "Run: yarn install && yarn dev"
          '';
        };
      });
}
