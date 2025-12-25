console.log("customer.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  console.log("customer.js loaded");

  const OPEN_HOUR = 6;   // 6 AM
  const CLOSE_HOUR = 23; // 11 PM
  const DAYS = 14;

  const availDateSelect = document.getElementById("availDateSelect");
  const bookDateSelect = document.getElementById("bookDateSelect");
  const startTimeSelect = document.getElementById("startTimeSelect");
  const endTimeSelect = document.getElementById("endTimeSelect");
  const availTableBody = document.getElementById("availTableBody");
  const bookingMsg = document.getElementById("bookingMsg");

  const pad = n => String(n).padStart(2, "0");
  
  function formatDateDDMMYYYY(dateObj) {
  const d = pad(dateObj.getDate());
  const m = pad(dateObj.getMonth() + 1);
  const y = dateObj.getFullYear();
  return `${d}-${m}-${y}`;
}


  // ================= LOAD DATES =================
 function loadDates() {
  availDateSelect.innerHTML = "";
  bookDateSelect.innerHTML = "";

  const today = new Date();

  for (let i = 0; i < DAYS; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);

    const displayVal = formatDateDDMMYYYY(d);

    availDateSelect.add(new Option(displayVal, displayVal));
    bookDateSelect.add(new Option(displayVal, displayVal));
  }
}

  // ================= START TIMES =================
  function loadStartTimes() {
    startTimeSelect.innerHTML = "";
    endTimeSelect.innerHTML = "";

    startTimeSelect.add(new Option("Select start time", ""));

    for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
      const t = `${pad(h)}:00`;
      startTimeSelect.add(new Option(t, t));
    }

    endTimeSelect.add(new Option("Select end time", ""));
  }

  // ================= END TIMES =================
  function loadEndTimes() {
    endTimeSelect.innerHTML = "";
    endTimeSelect.add(new Option("Select end time", ""));

    if (!startTimeSelect.value) return;

    const startHour = parseInt(startTimeSelect.value.split(":")[0], 10);

    for (let h = startHour + 1; h <= CLOSE_HOUR; h++) {
      const t = `${pad(h)}:00`;
      endTimeSelect.add(new Option(t, t));
    }
  }

  // ================= AVAILABILITY =================
 async function loadAvailability() {
  availTableBody.innerHTML = "";

  const selectedDate = availDateSelect.value;
  if (!selectedDate) {
    availTableBody.innerHTML =
      `<tr><td colspan="2">Please select a date</td></tr>`;
    return;
  }

  try {
    const res = await fetch(`/api/availability?date=${encodeURIComponent(selectedDate)}`);

    if (!res.ok) {
      throw new Error("Availability API failed");
    }

    const slots = await res.json();

    if (!Array.isArray(slots) || slots.length === 0) {
      availTableBody.innerHTML =
        `<tr><td colspan="2">No available slots</td></tr>`;
      return;
    }

    slots.forEach(s => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${s.start}</td><td>${s.end}</td>`;
      availTableBody.appendChild(tr);
    });

  } catch (err) {
    console.error("Availability refresh failed:", err);
    availTableBody.innerHTML =
      `<tr><td colspan="2">Unable to load availability</td></tr>`;
  }
}

  // ================= BOOK SLOT =================
  async function bookSlot() {
  bookingMsg.textContent = "";

  const customerName = document.getElementById("customerName").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const email = document.getElementById("email").value.trim();
  const date = bookDateSelect.value;
  const startTime = startTimeSelect.value;
  const endTime = endTimeSelect.value;

  // 🔒 STRONG validation
  if (!customerName || !phone || !email || !date || !startTime || !endTime) {
    bookingMsg.textContent = "Please fill all fields including time.";
    return;
  }

  if (endTime <= startTime) {
    bookingMsg.textContent = "End time must be after start time.";
    return;
  }

  try {
    const res = await fetch("/api/book-slot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName,
        phone,
        email,
        date,
        startTime,
        endTime
      })
    });

    const data = await res.json();

    if (!res.ok) {
      bookingMsg.textContent = data.error || "Booking failed.";
      return;
    }

    bookingMsg.textContent = "✅ Slot booked successfully!";
    loadAvailability();

  } catch (err) {
  console.error(err);
  bookingMsg.textContent = "Booking completed, but availability refresh failed.";
}
}


  // ================= EVENTS =================
  document.getElementById("checkAvailBtn").onclick = loadAvailability;
  document.getElementById("bookBtn").onclick = bookSlot;
  startTimeSelect.addEventListener("change", () => {
  console.log("Start time selected:", startTimeSelect.value);
  loadEndTimes();
});


  // ================= INIT =================
  loadDates();
  loadStartTimes();
});
