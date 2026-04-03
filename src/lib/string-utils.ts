/**
 * Removes all percentage signs (%) from a given string or text input.
 * Handles null/undefined inputs, empty strings, and multiple consecutive percentage signs.
 * 
 * @param input - The string to process
 * @returns The string with all '%' characters removed, or an empty string if input is null/undefined
 */
export function removePercentage(input: string | null | undefined): string {
  if (input === null || input === undefined) {
    return "";
  }
  
  if (typeof input !== "string") {
    // Basic error handling for non-string inputs at runtime
    return "";
  }

  // Use global regex to remove all occurrences of '%'
  return input.replace(/%/g, "");
}
