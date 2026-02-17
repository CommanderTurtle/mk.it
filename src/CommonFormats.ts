import { FormatDefinition } from "src/FormatHandler"

/**
 * Common format definitions which can be used to reduce boilerplate definitions
 */
const CommonFormats = {
    PNG: new FormatDefinition(
        "Portable Network Graphics",
        "png",
        "png",
        "image/png"
    ),
    JSON: new FormatDefinition(
        "JavaScript Object Notation",
        "json",
        "json",
        "application/json"
    )
}

export default CommonFormats