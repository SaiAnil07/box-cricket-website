console.log("customer.js loaded");

document.addEventListener("DOMContentLoaded", () => {

  const OPEN_HOUR = 0;   // 12 AM
  const CLOSE_HOUR = 24; // 12 AM
  const DAYS = 14;

  const availDateSelect = document.getElementById("availDateSelect");
  const bookDateSelect = document.getElementById("bookDateSelect");
  const startTimeSelect = document.getElementById("startTimeSelect");
  const endTimeSelect = document.getElementById("endTimeSelect");
  const availTableBody = document.getElementById("availTableBody");
  const bookingMsg = document.getElementById("bookingMsg");

  const pad = n => String(n).padStart(2, "0");

  // ================= DATE =================
  function formatDate(d) {
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
  }

  // ================= TIME FORMAT =================
  function to12Hour(hour) {
    const h = hour % 12 || 12;
    const ampm = hour >= 12 ? "PM" : "AM";
    return `${h}:00 ${ampm}`;
  }

  function to24Hour(hour) {
    return `${pad(hour)}:00`;
  }

  // ================= LOAD DATES =================
  function loadDates() {
    availDateSelect.innerHTML = "";
    bookDateSelect.innerHTML = "";

    const today = new Date();

    for (let i = 0; i < DAYS; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const val = formatDate(d);

      availDateSelect.add(new Option(val, val));
      bookDateSelect.add(new Option(val, val));
    }
  }

  // ================= START TIMES =================
  function loadStartTimes() {
    startTimeSelect.innerHTML = "";
    endTimeSelect.innerHTML = "";

    startTimeSelect.add(new Option("Select start time", ""));

    for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
      startTimeSelect.add(
        new Option(to12Hour(h), to24Hour(h))
      );
    }

    endTimeSelect.add(new Option("Select end time", ""));
  }

  // ================= END TIMES =================
  function loadEndTimes() {
    endTimeSelect.innerHTML = "";
    endTimeSelect.add(new Option("Select end time", ""));

    if (!startTimeSelect.value) return;

    const startHour = parseInt(startTimeSelect.value.split(":")[0]);

    for (let h = startHour + 1; h <= CLOSE_HOUR; h++) {
      endTimeSelect.add(
        new Option(to12Hour(h), to24Hour(h))
      );
    }
  }

  // ================= AVAILABILITY =================
  async function loadAvailability() {
    availTableBody.innerHTML = "";

    const date = availDateSelect.value;
    if (!date) return;

    const res = await fetch(`/api/availability?date=${date}`);
    const slots = await res.json();

    if (!slots.length) {
      availTableBody.innerHTML =
        `<tr><td colspan="2">No available slots</td></tr>`;
      return;
    }

    slots.forEach(s => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${to12Hour(parseInt(s.start))}</td>
        <td>${to12Hour(parseInt(s.end))}</td>
      `;
      availTableBody.appendChild(tr);
    });
  }

  // ================= BOOK SLOT =================
  async function bookSlot() {
    bookingMsg.textContent = "";

    const data = {
      customerName: customerName.value.trim(),
      phone: phone.value.trim(),
      email: email.value.trim(),
      date: bookDateSelect.value,
      startTime: startTimeSelect.value,
      endTime: endTimeSelect.value
    };

    if (Object.values(data).some(v => !v)) {
      bookingMsg.textContent = "❌ Please fill all fields";
      return;
    }

    const res = await fetch("/api/book-slot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (!res.ok) {
      bookingMsg.textContent = result.error;
      return;
    }

    bookingMsg.textContent = `✅ Booked successfully (₹${result.amount})`;
    loadAvailability();
  }

  // ================= EVENTS =================
  document.getElementById("checkAvailBtn").onclick = loadAvailability;
  document.getElementById("bookBtn").onclick = bookSlot;
  startTimeSelect.addEventListener("change", loadEndTimes);

  // ================= INIT =================
  loadDates();
  loadStartTimes();
});
