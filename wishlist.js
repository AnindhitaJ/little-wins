function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const PRIORITY_LABELS = { 1: "Low", 2: "Medium", 3: "High" };

export function createWishlistController({
  fetchWishlist,
  createWishlistItem,
  updateWishlistItem,
  deleteWishlistItem,
  onSuccess,
  onError
}) {
  let items = [];
  const dialog = document.getElementById("wishlistDialog");
  const form = document.getElementById("wishlistForm");

  function openDialog(item = null) {
    document.getElementById("wishlistDialogTitle").textContent = item ? "Edit wishlist item" : "Add something lovely";
    document.getElementById("wishlistItemId").value = item?.id || "";
    document.getElementById("wishlistName").value = item?.name || "";
    document.getElementById("wishlistCategory").value = item?.category || "";
    document.getElementById("wishlistPriority").value = String(item?.priority || 2);
    document.getElementById("wishlistOwned").checked = Boolean(item?.owned);
    dialog.showModal();
    setTimeout(() => document.getElementById("wishlistName").focus(), 50);
  }

  function closeDialog() {
    dialog.close();
    form.reset();
    document.getElementById("wishlistItemId").value = "";
  }

  async function load() {
    try {
      items = await fetchWishlist();
      render();
    } catch (error) {
      onError(error);
    }
  }

  function filteredItems() {
    const query = document.getElementById("wishlistSearch").value.trim().toLowerCase();
    const filter = document.getElementById("wishlistFilter").value;
    const sort = document.getElementById("wishlistSort").value;

    const result = items.filter((item) => {
      const matchesQuery = !query || `${item.name} ${item.category || ""}`.toLowerCase().includes(query);
      const matchesFilter = filter === "all" || (filter === "owned" ? item.owned : !item.owned);
      return matchesQuery && matchesFilter;
    });

    result.sort((a, b) => {
      if (sort === "oldest") return new Date(a.created_at) - new Date(b.created_at);
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "priority") return b.priority - a.priority || a.name.localeCompare(b.name);
      return new Date(b.created_at) - new Date(a.created_at);
    });

    return result;
  }

  function render() {
    const visibleItems = filteredItems();
    const list = document.getElementById("wishlistList");
    const empty = document.getElementById("wishlistEmpty");
    empty.classList.toggle("hidden", visibleItems.length > 0);

    list.innerHTML = visibleItems.map((item) => `
      <article class="wishlist-item ${item.owned ? "owned" : ""}" data-id="${item.id}">
        <button class="wishlist-check ${item.owned ? "checked" : ""}" data-action="toggle" type="button" aria-label="${item.owned ? "Mark as not collected" : "Mark as collected"}">${item.owned ? "✓" : ""}</button>
        <div class="wishlist-copy">
          <h3>${escapeHTML(item.name)}</h3>
          <div class="wishlist-meta">
            ${item.category ? `<span class="pill">${escapeHTML(item.category)}</span>` : ""}
            <span class="pill ${item.priority === 3 ? "priority-high" : ""}">${PRIORITY_LABELS[item.priority]} priority</span>
            ${item.owned ? '<span class="pill">Collected</span>' : ""}
          </div>
        </div>
        <div class="wishlist-actions">
          <button class="mini-button" data-action="edit" type="button" aria-label="Edit ${escapeHTML(item.name)}">✎</button>
          <button class="mini-button delete" data-action="delete" type="button" aria-label="Delete ${escapeHTML(item.name)}">×</button>
        </div>
      </article>
    `).join("");
  }

  async function handleListClick(event) {
    const button = event.target.closest("[data-action]");
    const card = event.target.closest("[data-id]");
    if (!button || !card) return;
    const id = Number(card.dataset.id);
    const item = items.find((entry) => entry.id === id);
    if (!item) return;

    try {
      if (button.dataset.action === "edit") {
        openDialog(item);
      } else if (button.dataset.action === "toggle") {
        const updated = await updateWishlistItem(id, { owned: !item.owned });
        items = items.map((entry) => entry.id === id ? updated : entry);
        render();
        onSuccess(updated.owned ? "Marked as collected." : "Moved back to your wishlist.");
      } else if (button.dataset.action === "delete") {
        const confirmed = window.confirm(`Delete “${item.name}” from your wishlist?`);
        if (!confirmed) return;
        await deleteWishlistItem(id);
        items = items.filter((entry) => entry.id !== id);
        render();
        onSuccess("Wishlist item deleted.");
      }
    } catch (error) {
      onError(error);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    const id = Number(document.getElementById("wishlistItemId").value) || null;
    const payload = {
      name: document.getElementById("wishlistName").value.trim(),
      category: document.getElementById("wishlistCategory").value.trim() || null,
      priority: Number(document.getElementById("wishlistPriority").value),
      owned: document.getElementById("wishlistOwned").checked
    };

    if (!payload.name) return;
    submitButton.disabled = true;
    try {
      if (id) {
        const updated = await updateWishlistItem(id, payload);
        items = items.map((entry) => entry.id === id ? updated : entry);
        onSuccess("Wishlist item updated.");
      } else {
        const created = await createWishlistItem(payload);
        items.unshift(created);
        onSuccess("Wishlist item added.");
      }
      render();
      closeDialog();
    } catch (error) {
      onError(error);
    } finally {
      submitButton.disabled = false;
    }
  }

  function initialize() {
    document.getElementById("addWishlistButton").addEventListener("click", () => openDialog());
    document.getElementById("closeWishlistDialog").addEventListener("click", closeDialog);
    document.getElementById("cancelWishlistButton").addEventListener("click", closeDialog);
    document.getElementById("wishlistList").addEventListener("click", handleListClick);
    document.getElementById("wishlistSearch").addEventListener("input", render);
    document.getElementById("wishlistFilter").addEventListener("change", render);
    document.getElementById("wishlistSort").addEventListener("change", render);
    form.addEventListener("submit", handleSubmit);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog();
    });
    return load();
  }

  return { initialize, refresh: load };
}
