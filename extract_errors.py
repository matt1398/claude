#!/usr/bin/env python3
"""
Extract and segment errors from Claude session JSONL files.
Searches for lines with "is_error":true and categorizes them.
"""

import json
import glob
import os
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Any
import re

def extract_error_type(error_content: str) -> str:
    """Categorize error based on content."""
    error_patterns = [
        (r"Exit code \d+", "Exit Code Error"),
        (r"ENOENT", "File Not Found"),
        (r"EISDIR", "Directory Operation Error"),
        (r"EACCES", "Permission Denied"),
        (r"EEXIST", "File Already Exists"),
        (r"File does not exist", "File Not Found"),
        (r"command not found", "Command Not Found"),
        (r"No such file or directory", "File Not Found"),
        (r"syntax error", "Syntax Error"),
        (r"type.*Error", "Type Error"),
        (r"Cannot find", "Not Found Error"),
        (r"timeout", "Timeout Error"),
        (r"connection", "Connection Error"),
    ]

    for pattern, category in error_patterns:
        if re.search(pattern, error_content, re.IGNORECASE):
            return category

    return "Other Error"

def parse_jsonl_for_errors(file_path: str) -> List[Dict[str, Any]]:
    """Parse a JSONL file and extract lines with is_error:true."""
    errors = []

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue

                # Quick check before parsing
                if '"is_error":true' not in line:
                    continue

                try:
                    data = json.loads(line)

                    # Check if this line has is_error:true
                    if data.get('message', {}).get('content'):
                        content = data['message']['content']
                        if isinstance(content, list):
                            for item in content:
                                if isinstance(item, dict) and item.get('is_error') is True:
                                    # Extract relevant info
                                    error_info = {
                                        'source_file': file_path,
                                        'line_number': line_num,
                                        'uuid': data.get('uuid'),
                                        'timestamp': data.get('timestamp'),
                                        'session_id': data.get('sessionId'),
                                        'agent_id': data.get('agentId'),
                                        'cwd': data.get('cwd'),
                                        'tool_use_id': item.get('tool_use_id'),
                                        'error_content': item.get('content', ''),
                                        'tool_use_result': data.get('toolUseResult', ''),
                                        'full_line': data
                                    }

                                    # Categorize error
                                    error_info['error_category'] = extract_error_type(
                                        error_info['error_content']
                                    )

                                    errors.append(error_info)

                except json.JSONDecodeError as e:
                    print(f"Warning: Failed to parse line {line_num} in {file_path}: {e}")
                    continue

    except Exception as e:
        print(f"Error reading file {file_path}: {e}")

    return errors

def main():
    # Find all JSONL files in ~/.claude/projects/
    projects_dir = Path.home() / '.claude' / 'projects'

    if not projects_dir.exists():
        print(f"Error: {projects_dir} does not exist")
        return

    print(f"Scanning {projects_dir}...")

    # Find all .jsonl files recursively
    jsonl_files = list(projects_dir.glob('**/*.jsonl'))
    print(f"Found {len(jsonl_files)} JSONL files")

    # Extract errors from all files
    all_errors = []
    for i, jsonl_file in enumerate(jsonl_files, 1):
        if i % 10 == 0:
            print(f"Processing {i}/{len(jsonl_files)}...")

        errors = parse_jsonl_for_errors(str(jsonl_file))
        all_errors.extend(errors)

    print(f"\nFound {len(all_errors)} total errors")

    # Segment errors by category
    errors_by_category = defaultdict(list)
    for error in all_errors:
        errors_by_category[error['error_category']].append(error)

    # Print summary
    print("\n=== Error Summary ===")
    for category, errors in sorted(errors_by_category.items(), key=lambda x: len(x[1]), reverse=True):
        print(f"{category}: {len(errors)} errors")

    # Write to error.jsonl with segmentation
    output_file = Path.cwd() / 'error.jsonl'

    with open(output_file, 'w', encoding='utf-8') as f:
        # Write metadata header
        f.write(json.dumps({
            'type': 'metadata',
            'total_errors': len(all_errors),
            'files_scanned': len(jsonl_files),
            'categories': {cat: len(errs) for cat, errs in errors_by_category.items()}
        }) + '\n')

        # Write errors grouped by category
        for category in sorted(errors_by_category.keys()):
            # Category header
            f.write(json.dumps({
                'type': 'category_header',
                'category': category,
                'count': len(errors_by_category[category])
            }) + '\n')

            # All errors in this category
            for error in errors_by_category[category]:
                f.write(json.dumps(error) + '\n')

    print(f"\n✓ Errors written to: {output_file}")

    # Also create a summary file
    summary_file = Path.cwd() / 'error_summary.json'

    summary = {
        'total_errors': len(all_errors),
        'files_scanned': len(jsonl_files),
        'categories': {},
        'recent_errors': sorted(all_errors, key=lambda x: x['timestamp'], reverse=True)[:20]
    }

    for category, errors in errors_by_category.items():
        summary['categories'][category] = {
            'count': len(errors),
            'examples': [
                {
                    'timestamp': e['timestamp'],
                    'session_id': e['session_id'],
                    'error_content': e['error_content'][:500]  # Truncate
                }
                for e in errors[:100]  # Top 3 examples
            ]
        }

    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2)

    print(f"✓ Summary written to: {summary_file}")

if __name__ == '__main__':
    main()
