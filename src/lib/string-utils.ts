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

/**
 * Replaces placeholders like $effect_chance% in PokeAPI descriptions with actual values.
 * 
 * @param description - The description string containing placeholders
 * @param effectChance - The actual effect chance value
 * @returns The cleaned description
 */
export function sanitizePokeApiDescription(description: string | null | undefined, effectChance?: number | string | null): string {
  if (!description) return "";
  
  let sanitized = description
    .replace(/\$effect_chance%/g, effectChance ? `${effectChance}%` : "")
    .replace(/\$effect_chance/g, effectChance ? `${effectChance}` : "")
    // Remove PokeAPI tags like [ability:overgrow] or {ability:overgrow}
    .replace(/[\[\]{}]/g, "")
    .replace(/(ability|move|item|type|pokemon):/g, "")
    // PokeAPI descriptions often have special characters or formatting that can be cleaned
    .replace(/[\n\r\f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return sanitized;
}

