// Keep the existing student and school presentation unchanged; route only
// nonprofit entry points to the full coordinator workspace.
const destination = "/?view=nonprofit&page=Events&demo=herwell";
if (new URLSearchParams(location.search).get("role") === "nonprofit") {
  location.replace(destination);
} else {
  document.addEventListener(
    "click",
    (event) => {
      if (event.target.closest('[data-vu="nonprofit"]')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        location.assign(destination);
      }
    },
    true,
  );
  import("./presentation-demo.js");
}
