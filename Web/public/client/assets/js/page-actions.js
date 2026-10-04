// Copy page (Markdown), copy link and native share for [data-page-actions] groups (views/client/partials/page-actions.pug).
(function () {
  var groups = document.querySelectorAll("[data-page-actions]");
  if (!groups.length) return;

  var announce = function (message, ok) {
    var live = document.getElementById("sr-live-region");
    if (live) live.textContent = message;
    if (window.notyf) window.notyf[ok ? "success" : "error"](message);
  };

  var copyText = function (text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return Promise.reject(new Error("Clipboard unavailable"));
  };

  // The clipboard write starts inside the click handler (Safari drops writes made after an await).
  var copyMarkdown = function (mdPath) {
    var markdown = fetch(mdPath, { headers: { Accept: "text/markdown" } }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    });
    if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
      var item = new ClipboardItem({
        "text/plain": markdown.then(function (text) { return new Blob([text], { type: "text/plain" }); })
      });
      return navigator.clipboard.write([item]).catch(function () {
        return markdown.then(copyText);
      });
    }
    return markdown.then(copyText);
  };

  groups.forEach(function (group) {
    var mdPath = group.getAttribute("data-md-path");
    var pageUrl = group.getAttribute("data-page-url");
    var pageTitle = group.getAttribute("data-page-title");

    var shareButton = group.querySelector('[data-page-action="share"]');
    if (shareButton && navigator.share) shareButton.hidden = false;

    group.addEventListener("click", function (event) {
      var button = event.target.closest("[data-page-action]");
      if (!button) return;
      var action = button.getAttribute("data-page-action");

      if (action === "copy-page") {
        copyMarkdown(mdPath).then(
          function () { announce("Page copied as Markdown", true); },
          function () { announce("Could not copy the page. Use View as Markdown instead.", false); }
        );
      } else if (action === "copy-url") {
        copyText(pageUrl).then(
          function () { announce("Link copied", true); },
          function () { announce("Could not copy the link", false); }
        );
      } else if (action === "share") {
        navigator.share({ title: pageTitle, url: pageUrl }).catch(function () {});
      }
    });
  });
})();
