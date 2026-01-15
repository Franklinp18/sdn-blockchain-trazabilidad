window.toast = {
  show(message, type = "success") {
    const container = $("#toast-container");
    if (!container) return;

    const toastEl = document.createElement("div");
    const colors =
      type === "success"
        ? "bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700"
        : type === "error"
        ? "bg-red-50 border-l-4 border-red-500 text-red-700"
        : "bg-blue-50 border-l-4 border-blue-500 text-blue-700";

    toastEl.className =
      `p-4 rounded shadow-lg flex items-center gap-3 pointer-events-auto min-w-[300px] ` +
      `transition-all duration-300 transform translate-y-5 opacity-0 ${colors}`;

    toastEl.innerHTML = `<span class="font-bold text-sm">${type.toUpperCase()}</span> <span>${message}</span>`;

    container.appendChild(toastEl);

    requestAnimationFrame(() => {
      toastEl.classList.remove("translate-y-5", "opacity-0");
    });

    setTimeout(() => {
      toastEl.classList.add("translate-x-full", "opacity-0");
      setTimeout(() => toastEl.remove(), 300);
    }, 3000);
  }
};

