/**
 * FILE: src/surf/art.js
 *
 * OPTIONAL PHOTOGRAPHS FOR THE SCENES.
 *
 * Every page is drawn in front of an illustrated scene (src/surf/Scenes.jsx).
 * Put a photograph's URL against a scene here and that page uses the
 * photograph instead, with the same dark scrim over it so text stays readable.
 * Leave it null and the illustration is used. Both are finished states; null is
 * not a placeholder.
 *
 * Use an image you have the rights to — anything generated for the brand, or
 * licensed stock. A URL rather than a bundled file, because the app builds with
 * a relative base and can be served from a subpath, and a URL is also how the
 * company logo is already handled.
 *
 *   wave   Home, and the Storage tab     (a barrel wave at golden hour)
 *   palms  the Sandbox and Clients       (a cove of palms at dusk)
 *   beach  The Beach                     (a beach hut at dusk)
 */
export const ART = {
  wave: null,
  palms: null,
  beach: null
};

export default ART;
