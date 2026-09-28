#!/usr/bin/env python3
"""Compatibility entry point for the explicit versioned revision builder.

The former fourteen-column script remains in Git history, not claimed to have
generated the historical eleven-column CSV. Explicit source/output are required.
"""
from rebuild_corpus import main

if __name__ == '__main__':
    main()
