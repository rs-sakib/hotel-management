const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const longMonthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const weekdays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
let globalDismissReady = false;

export function initCustomControls(root = document) {
  enhanceSelects(root);
  enhanceDatePickers(root);
  enhanceNumberInputs(root);
  initGlobalDismiss();
  initCustomValidation(root);
}

function enhanceSelects(root) {
  root.querySelectorAll("select:not([data-enhanced-select])").forEach((select) => {
    select.dataset.enhancedSelect = "true";
    select.classList.add("native-control-hidden");

    const wrapper = document.createElement("div");
    wrapper.className = "custom-select";
    wrapper.innerHTML = `
      <button class="custom-select-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">
        <span data-select-value></span>
        <span class="control-chevron" aria-hidden="true"></span>
      </button>
      <div class="custom-select-menu" role="listbox"></div>
    `;

    select.after(wrapper);
    const trigger = wrapper.querySelector(".custom-select-trigger");
    const menu = wrapper.querySelector(".custom-select-menu");

    const render = () => {
      const selected = select.options[select.selectedIndex] || select.options[0];
      trigger.disabled = select.disabled;
      wrapper.classList.toggle("is-disabled", select.disabled);
      wrapper.querySelector("[data-select-value]").textContent = selected?.textContent || "Select";
      menu.innerHTML = [...select.options]
        .map(
          (option) => `
            <button class="custom-option${option.value === select.value ? " selected" : ""}" type="button" role="option" data-value="${escapeAttr(option.value)}" aria-selected="${option.value === select.value}">
              ${escapeHtml(option.textContent)}
            </button>
          `
        )
        .join("");
    };

    trigger.addEventListener("click", () => {
      if (select.disabled) return;
      closeFloatingControls(wrapper);
      wrapper.classList.toggle("open");
      trigger.setAttribute("aria-expanded", String(wrapper.classList.contains("open")));
    });

    menu.addEventListener("click", (event) => {
      const option = event.target.closest("[data-value]");
      if (!option) return;
      select.value = option.dataset.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      wrapper.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
      render();
    });

    select.addEventListener("change", render);
    select.form?.addEventListener("reset", () => setTimeout(render, 0));
    render();
  });
}

function enhanceDatePickers(root) {
  root.querySelectorAll('input[type="date"]:not([data-enhanced-date])').forEach((input) => {
    input.dataset.enhancedDate = "true";
    if (input.required) {
      input.dataset.controlRequired = "true";
      input.required = false;
    }
    input.type = "text";
    input.inputMode = "none";
    input.classList.add("native-control-hidden");

    const wrapper = document.createElement("div");
    wrapper.className = "custom-date";
    wrapper.innerHTML = `
      <button class="custom-date-trigger" type="button" aria-haspopup="dialog" aria-expanded="false">
        <span data-date-value>Select date</span>
        <span class="date-icon" aria-hidden="true"></span>
      </button>
      <div class="date-popover" role="dialog" aria-label="Calendar picker"></div>
    `;

    input.after(wrapper);
    const trigger = wrapper.querySelector(".custom-date-trigger");
    const popover = wrapper.querySelector(".date-popover");
    let viewDate = parseDate(input.value) || new Date();

    const updateTrigger = () => {
      wrapper.querySelector("[data-date-value]").textContent = input.value ? formatReadableDate(input.value) : input.getAttribute("placeholder") || "Select date";
      wrapper.classList.toggle("has-value", Boolean(input.value));
    };

    const renderCalendar = () => {
      const year = viewDate.getFullYear();
      const month = viewDate.getMonth();
      const selected = input.value;
      const firstDay = new Date(year, month, 1);
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const offset = (firstDay.getDay() + 6) % 7;
      const blanks = Array.from({ length: offset }, () => `<span class="date-cell empty"></span>`).join("");
      const days = Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;
        const iso = toIsoDate(new Date(year, month, day));
        return `<button class="date-cell${iso === selected ? " selected" : ""}" type="button" data-date="${iso}">${day}</button>`;
      }).join("");

      popover.innerHTML = `
        <div class="date-head">
          <button class="date-nav" type="button" data-month-nav="-1" aria-label="Previous month"></button>
          <strong>${longMonthNames[month]} ${year}</strong>
          <button class="date-nav next" type="button" data-month-nav="1" aria-label="Next month"></button>
        </div>
        <div class="date-weekdays">${weekdays.map((day) => `<span>${day}</span>`).join("")}</div>
        <div class="date-grid">${blanks}${days}</div>
        <div class="date-footer">
          <button type="button" data-date-today>Today</button>
          <button type="button" data-date-clear>Clear</button>
        </div>
      `;
    };

    trigger.addEventListener("click", () => {
      closeFloatingControls(wrapper);
      wrapper.classList.toggle("open");
      trigger.setAttribute("aria-expanded", String(wrapper.classList.contains("open")));
      viewDate = parseDate(input.value) || viewDate;
      renderCalendar();
    });

    popover.addEventListener("click", (event) => {
      const nav = event.target.closest("[data-month-nav]");
      const dateButton = event.target.closest("[data-date]");
      const todayButton = event.target.closest("[data-date-today]");
      const clearButton = event.target.closest("[data-date-clear]");

      if (nav) {
        viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + Number(nav.dataset.monthNav), 1);
        renderCalendar();
      }

      if (dateButton) {
        input.value = dateButton.dataset.date;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        wrapper.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");
        updateTrigger();
      }

      if (todayButton) {
        input.value = toIsoDate(new Date());
        viewDate = parseDate(input.value);
        input.dispatchEvent(new Event("change", { bubbles: true }));
        renderCalendar();
        updateTrigger();
      }

      if (clearButton) {
        input.value = "";
        input.dispatchEvent(new Event("change", { bubbles: true }));
        renderCalendar();
        updateTrigger();
      }
    });

    input.addEventListener("change", updateTrigger);
    input.form?.addEventListener("reset", () => {
      setTimeout(() => {
        viewDate = parseDate(input.value) || new Date();
        updateTrigger();
        renderCalendar();
      }, 0);
    });

    updateTrigger();
    renderCalendar();
  });
}

function enhanceNumberInputs(root) {
  root.querySelectorAll('input[type="number"]:not([data-enhanced-number])').forEach((input) => {
    input.dataset.enhancedNumber = "true";
    input.classList.add("custom-number-input");

    const wrapper = document.createElement("div");
    wrapper.className = "custom-number";
    input.before(wrapper);
    wrapper.appendChild(input);

    const minus = document.createElement("button");
    minus.className = "number-step";
    minus.type = "button";
    minus.dataset.numberStep = "-1";
    minus.setAttribute("aria-label", "Decrease value");

    const plus = document.createElement("button");
    plus.className = "number-step plus";
    plus.type = "button";
    plus.dataset.numberStep = "1";
    plus.setAttribute("aria-label", "Increase value");

    wrapper.prepend(minus);
    wrapper.appendChild(plus);

    wrapper.addEventListener("click", (event) => {
      const stepButton = event.target.closest("[data-number-step]");
      if (!stepButton) return;
      const step = Number(input.step || 1) * Number(stepButton.dataset.numberStep);
      const min = input.min === "" ? -Infinity : Number(input.min);
      const max = input.max === "" ? Infinity : Number(input.max);
      const current = input.value === "" ? (Number.isFinite(min) ? min : 0) : Number(input.value);
      const next = Math.min(max, Math.max(min, current + step));
      input.value = String(next);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
}

function initGlobalDismiss() {
  if (globalDismissReady) return;
  globalDismissReady = true;
  document.addEventListener("click", (event) => closeFloatingControls(event.target.closest(".custom-select, .custom-date")));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeFloatingControls();
  });
}

function closeFloatingControls(except = null) {
  document.querySelectorAll(".custom-select.open, .custom-date.open").forEach((control) => {
    if (control === except) return;
    control.classList.remove("open");
    control.querySelector("[aria-expanded]")?.setAttribute("aria-expanded", "false");
  });
}

function initCustomValidation(root) {
  root.querySelectorAll("form:not([data-custom-validation])").forEach((form) => {
    form.dataset.customValidation = "true";
    form.addEventListener(
      "submit",
      (event) => {
        const invalid = [...form.querySelectorAll("[data-control-required='true']")].find((control) => !control.value);
        form.querySelectorAll(".custom-invalid").forEach((control) => control.classList.remove("custom-invalid"));
        if (!invalid) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const visual = invalid.nextElementSibling;
        visual?.classList.add("custom-invalid");
        visual?.querySelector("button")?.focus();
      },
      true
    );
  });
}

function parseDate(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatReadableDate(value) {
  const date = parseDate(value);
  if (!date) return value;
  return `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value);
}
