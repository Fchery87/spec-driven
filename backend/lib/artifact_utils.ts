/**
 * Utility functions for artifact handling
 */

/**
 * Safely converts a string or Buffer to a string.
 * Used when artifact content may come from readArtifact which returns string | Buffer
 * for binary file support, but the consumer expects a string.
 *
 * @param content - The content to convert (string or Buffer)
 * @returns The content as a string
 */
export function asString(content: string | Buffer): string {
  if (Buffer.isBuffer(content)) {
    return content.toString('utf-8');
  }
  return content;
}

/**
 * Safely converts all values in a Record from string | Buffer to string.
 * Used for artifact collections that may contain binary data.
 *
 * @param artifacts - Record with string or Buffer values
 * @returns Record with only string values
 */
export function asStringRecord(
  artifacts: Record<string, string | Buffer>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(artifacts)) {
    result[key] = asString(value);
  }
  return result;
}
