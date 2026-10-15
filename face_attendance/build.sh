#!/usr/bin/env bash
# build.sh — Render build script
# Installs cmake (required by dlib) then all Python dependencies.
set -e

echo "==> Installing cmake via pip (build dependency for dlib)..."
pip install --upgrade pip
pip install cmake

echo "==> Installing Python dependencies..."
pip install -r requirements.txt

echo "==> Creating required directories..."
mkdir -p static/faces

echo "==> Build complete."
