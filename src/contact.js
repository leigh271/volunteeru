// Only explicit public contact fields from opportunity records are rendered.
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function contactMarkup(opportunity) {
  let website = null;
  try {
    const url = new URL(opportunity.website);
    if (["https:", "http:"].includes(url.protocol)) website = url.href;
  } catch {
    /* Demo listings have no verified website. */
  }
  const contact =
    typeof opportunity.publicContact === "string"
      ? opportunity.publicContact.trim()
      : "";
  if (!website && !contact)
    return "<p>Unavailable in this demo. These fictional organizations have no verified website or contact details.</p>";
  return `<p>${website ? `<a class="public-link" href="${escape(website)}" target="_blank" rel="noopener noreferrer">Visit nonprofit website ↗</a>` : "No public website provided."}${contact ? `<br>${escape(contact)}` : "<br>No public contact provided."}</p>`;
}
