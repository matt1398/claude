#!/bin/bash

# Simple JSONL sanitizer - removes long text and base64 image data
# Usage: ./sanitize_jsonl.sh <input.jsonl> [output.jsonl]

set -euo pipefail

INPUT_FILE="${1:-}"
OUTPUT_FILE="${2:-}"

if [[ -z "$INPUT_FILE" ]]; then
    echo "Usage: $0 <input.jsonl> [output.jsonl]"
    echo ""
    echo "If output file is not specified, prints to stdout"
    exit 1
fi

if [[ ! -f "$INPUT_FILE" ]]; then
    echo "Error: File not found: $INPUT_FILE"
    exit 1
fi

# Function to sanitize each JSON line
sanitize_json() {
    jq -c '
        walk(
            if type == "object" then
                # Remove base64 image data
                if has("type") and .type == "image" and has("source") and .source.type == "base64" then
                    .source.data = "[BASE64_IMAGE_REMOVED]"
                # Remove signature (long encrypted string)
                elif has("signature") then
                    .signature = "[SIGNATURE_REMOVED]"
                # Truncate long thinking
                elif has("thinking") and (.thinking | type) == "string" and (.thinking | length) > 100 then
                    .thinking = (.thinking[0:100] + "... [TRUNCATED " + ((.thinking | length) - 100 | tostring) + " chars]")
                # Truncate long prompt
                elif has("prompt") and (.prompt | type) == "string" and (.prompt | length) > 100 then
                    .prompt = (.prompt[0:100] + "... [TRUNCATED " + ((.prompt | length) - 100 | tostring) + " chars]")
                # Truncate long text in "text" field
                elif has("type") and .type == "text" and has("text") and (.text | length) > 100 then
                    .text = (.text[0:100] + "... [TRUNCATED " + ((.text | length) - 100 | tostring) + " chars]")
                # Truncate long "content" string
                elif has("content") and (.content | type) == "string" and (.content | length) > 100 then
                    .content = (.content[0:100] + "... [TRUNCATED " + ((.content | length) - 100 | tostring) + " chars]")
                # Truncate long "message" string
                elif has("message") and (.message | type) == "string" and (.message | length) > 100 then
                    .message = (.message[0:100] + "... [TRUNCATED " + ((.message | length) - 100 | tostring) + " chars]")
                else
                    .
                end
            else
                .
            end
        )
    '
}

# Process the file
if [[ -z "$OUTPUT_FILE" ]]; then
    # Output to stdout
    cat "$INPUT_FILE" | sanitize_json
else
    # Output to file
    cat "$INPUT_FILE" | sanitize_json > "$OUTPUT_FILE"
    echo "Sanitized JSONL written to: $OUTPUT_FILE"
fi
