export default function generateUUIDv7(): string {
    let unixTsMs = Date.now(); // Unix timestamp in milliseconds (48-bit value)

    // Generate 16 random bytes for the UUID
    const bytes = new Uint8Array(16);
    // Use Web Crypto API for better randomness, falls back to Node.js crypto if needed
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
        crypto.getRandomValues(bytes);
    } else {
        // Fallback for environments without Web Crypto API (e.g., older Node.js without polyfill)
        // In Node.js, you'd typically use require('crypto').randomBytes
        // For a browser environment, this else block might not be needed if crypto.getRandomValues is always available.
        for (let i = 0; i < 16; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
    }

    // Set the 48-bit timestamp (unixts_ms) into the first 6 bytes (48 bits)
    // Extract bytes from MSB to LSB using division and modulo
    // Note: The timestamp is 48-bit, fitting in a 64-bit float without loss of precision for integer milliseconds.
    // We are extracting bytes from index 0 (MSB) to 5 (LSB).
    bytes[0] = Math.floor(unixTsMs / Math.pow(2, 40)) % 256;
    bytes[1] = Math.floor(unixTsMs / Math.pow(2, 32)) % 256;
    bytes[2] = Math.floor(unixTsMs / Math.pow(2, 24)) % 256;
    bytes[3] = Math.floor(unixTsMs / Math.pow(2, 16)) % 256;
    bytes[4] = Math.floor(unixTsMs / Math.pow(2, 8)) % 256;
    bytes[5] = Math.floor(unixTsMs) % 256;

    // Set the version to 7 (0111) in the top 4 bits of the 7th byte (index 6)
    bytes[6] = (bytes[6] & 0x0f) | 0x70; // Clear top 4 bits, then OR with 0x70

    // Set the variant to RFC 4122 (10xx) in the top 2 bits of the 9th byte (index 8)
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Clear top 2 bits, then OR with 0x80 (1000xxxx)

    // Format bytes to standard UUID string representation
    const hex = Array.from(bytes, (byte) =>
        byte.toString(16).padStart(2, "0")
    ).join("");

    return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(
        12,
        16
    )}-${hex.substring(16, 20)}-${hex.substring(20)}`;
}
