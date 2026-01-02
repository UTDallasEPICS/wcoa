{ pkgs ? import <nixpkgs> {} }:
let
  unstable = import (fetchTarball "https://github.com/NixOS/nixpkgs/archive/nixos-unstable.tar.gz") {};
  # Use prisma-engines from unstable which is at least version 7.x
  prisma-engines = if unstable ? prisma-engines_7 then unstable.prisma-engines_7 else unstable.prisma-engines;
in
pkgs.mkShell {
  buildInputs = with pkgs; [
    prisma-engines
    openssl
    zlib
    nodePackages.pnpm
  ];
  shellHook = ''
    export PRISMA_SCHEMA_ENGINE_BINARY="${prisma-engines}/bin/schema-engine"
    export PRISMA_QUERY_ENGINE_BINARY="${prisma-engines}/bin/query-engine"
    export PRISMA_QUERY_ENGINE_LIBRARY="${prisma-engines}/lib/libquery_engine.node"
    export PRISMA_FMT_BINARY="${prisma-engines}/bin/prisma-fmt"

    # Some Prisma operations need these in the library path
    export LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath [ pkgs.openssl pkgs.stdenv.cc.cc.lib pkgs.zlib ]}:$LD_LIBRARY_PATH"
    
        echo "Prisma environment initialized with engines from nixos-unstable (${prisma-engines.version})"
    
      '';
    
    }
    
    
