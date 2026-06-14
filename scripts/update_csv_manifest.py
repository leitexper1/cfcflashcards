#!/usr/bin/env python3
"""Generate the docs/csv-files.json manifest from the CSV files present on disk.

This helper keeps the front-end CSV selector in sync with the files shipped
in the `docs/` folder. Run it whenever you add or remove a CSV file.
"""

from __future__ import annotations

import argparse
import datetime
import json
import re
import sys
from pathlib import Path
from typing import Any, Iterable


def natural_sort_key(s: str) -> list[int | str]:
    """Clé de tri pour un ordre naturel (FET_2 < FET_10)."""
    return [int(text) if text.isdigit() else text.lower() 
            for text in re.split(r'(\d+)', s)]


def discover_csv_files(base_dir: Path, manifest_path: Path, preserve_order: bool = True) -> list[dict[str, Any]]:
    csv_files: list[dict[str, Any]] = []
    csv_dir = base_dir / 'csv'
    if not csv_dir.exists():
        return []

    # 1. Scanner les fichiers présents sur le disque
    disk_files = {p.name: p for p in csv_dir.glob('*.csv') if p.is_file()}
    
    # 2. Tenter de lire l'ordre actuel dans le manifeste pour le préserver
    ordered_names = []
    if manifest_path.exists():
        try:
            current_data = json.loads(manifest_path.read_text(encoding='utf-8'))
            for item in current_data:
                name = Path(item['path']).name
                if name in disk_files:
                    ordered_names.append(name)
        except Exception:
            pass

    # 3. Choix de la stratégie d'ordonnancement
    if preserve_order and ordered_names:
        # On garde l'ordre existant et on ajoute les nouveaux fichiers à la fin (triés naturellement)
        new_files = sorted([n for n in disk_files if n not in ordered_names], key=natural_sort_key)
        final_names = ordered_names + new_files
    else:
        # Tri naturel global (FET_2 < FET_10)
        final_names = sorted(disk_files.keys(), key=natural_sort_key)
    
    # 4. Construire la liste finale
    for name in final_names:
        path = disk_files[name]
        # Lecture pour compter les cartes (nombre de lignes non vides - 1 pour l'en-tête)
        content = path.read_text(encoding='utf-8')
        lines = [line for line in content.splitlines() if line.strip()]
        card_count = max(0, len(lines) - 1)
        # Récupération de la date de modification
        mtime = path.stat().st_mtime
        updated_date = datetime.datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
        csv_files.append({
            "path": f"csv/{path.name}",
            "count": card_count,
            "updated": updated_date
        })
    return csv_files


def write_manifest(json_path: Path, files: Iterable[dict[str, Any]]) -> None:
    payload = list(files)
    json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        '--docs-dir',
        type=Path,
        default=Path(__file__).resolve().parents[1] / 'docs',
        help='Directory that contains the CSV files and manifest (default: %(default)s)',
    )
    parser.add_argument(
        '--manifest-name',
        default='csv-files.json',
        help='Name of the manifest file to generate inside the docs directory (default: %(default)s)',
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    docs_dir: Path = args.docs_dir

    if not docs_dir.exists():
        raise SystemExit(f"Docs directory not found: {docs_dir}")

    manifest_path = docs_dir / args.manifest_name
    
    # Interaction utilisateur pour le tri
    preserve = True
    if manifest_path.exists():
        print(f"\n⚠️  Le fichier '{args.manifest_name}' existe déjà.")
        print("Voulez-vous conserver l'ordre manuel actuel ?")
        choice = input(" -> [O]ui (garde l'ordre) / [N]on (réinitialise en tri naturel FET_1, FET_2...) : ").lower().strip()
        if choice == 'n':
            preserve = False
            print("🔄 Réinitialisation de l'ordre avec un tri naturel...")
        else:
            print("✅ Conservation de l'ordre actuel. Les nouveaux fichiers seront ajoutés à la fin.")

    csv_files = discover_csv_files(docs_dir, manifest_path, preserve_order=preserve)

    if not csv_files:
        raise SystemExit('No CSV files were found — nothing to write in the manifest.')

    write_manifest(manifest_path, csv_files)
    print(f"Manifest updated with {len(csv_files)} file(s): {manifest_path}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
