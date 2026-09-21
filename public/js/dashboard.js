let currentUser = null;

document.addEventListener("DOMContentLoaded", async () => {
  const userData = await getCurrentUser();

  if (!userData.loggedIn) {
    window.location.href = "/login.html";
    return;
  }

  currentUser = userData.user;

  document.getElementById("welcomeText").textContent =
    `Welcome, ${currentUser.name}. Your role: ${currentUser.role}.`;

  document.getElementById("userRoleBadge").textContent =
    currentUser.role === "donor" ? "Donor view" : "Volunteer view";

  await loadDashboard();
  await loadDonations();
  await loadPickups();
});

async function loadDashboard() {
  const response = await fetch("/api/dashboard");
  const data = await response.json();

  if (!data.success) {
    return;
  }

  document.getElementById("totalDonations").textContent =
    data.dashboard.totalDonations;

  document.getElementById("foodRescued").textContent =
    data.dashboard.foodRescued;

  document.getElementById("pendingPickups").textContent =
    data.dashboard.pendingPickups;

  document.getElementById("activeVolunteers").textContent =
    data.dashboard.activeVolunteers;
}

async function loadDonations() {
  const response = await fetch("/api/donations");
  const data = await response.json();
  const container = document.getElementById("donationsList");

  if (!data.success || data.donations.length === 0) {
    container.innerHTML = `<div class="empty-state">No available donations right now.</div>`;
    return;
  }

  container.innerHTML = data.donations
    .map((donation) => {
      const volunteerButton =
        currentUser.role === "volunteer"
          ? `<button class="button primary small-button" onclick="requestPickup(${donation.id})">Request pickup</button>`
          : "";

      return `
        <article class="donation-card">
          <h3>${escapeHtml(donation.food_name)}</h3>
          <p><strong>${escapeHtml(donation.quantity)} ${escapeHtml(donation.unit)}</strong> · ${escapeHtml(donation.category)}</p>
          <p>📍 ${escapeHtml(donation.pickup_address)}</p>
          <p>⏰ Best before: ${escapeHtml(donation.expiry_time)}</p>
          <p>Donor: ${escapeHtml(donation.donor_name)}</p>
          <div class="donation-meta">
            <span class="status">${escapeHtml(donation.status)}</span>
            ${volunteerButton}
          </div>
        </article>
      `;
    })
    .join("");
}

async function requestPickup(donationId) {
  const message = prompt("Add a short pickup message:", "I can collect this donation soon.");

  if (message === null) {
    return;
  }

  const response = await fetch("/api/pickups", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      donationId,
      message
    })
  });

  const data = await response.json();
  alert(data.message);

  if (data.success) {
    await loadDashboard();
    await loadDonations();
  }
}

async function loadPickups() {
  const response = await fetch("/api/pickups");
  const data = await response.json();
  const container = document.getElementById("pickupsList");

  if (!data.success || data.pickups.length === 0) {
    container.innerHTML = `<div class="empty-state">No pickup requests yet.</div>`;
    return;
  }

  if (currentUser.role === "donor") {
    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Food</th>
            <th>Volunteer</th>
            <th>Phone</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${data.pickups
            .map(
              (pickup) => `
                <tr>
                  <td>${escapeHtml(pickup.food_name)}</td>
                  <td>${escapeHtml(pickup.volunteer_name)}</td>
                  <td>${escapeHtml(pickup.volunteer_phone || "Not provided")}</td>
                  <td><span class="status">${escapeHtml(pickup.status)}</span></td>
                  <td>
                    ${
                      pickup.status === "Pending"
                        ? `
                          <button class="button primary small-button" onclick="updatePickup(${pickup.id}, 'Accepted')">Accept</button>
                          <button class="button secondary small-button" onclick="updatePickup(${pickup.id}, 'Rejected')">Reject</button>
                        `
                        : pickup.status === "Accepted"
                        ? `<button class="button primary small-button" onclick="updatePickup(${pickup.id}, 'Completed')">Complete</button>`
                        : "-"
                    }
                  </td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `;
  } else {
    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Food</th>
            <th>Donor</th>
            <th>Address</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${data.pickups
            .map(
              (pickup) => `
                <tr>
                  <td>${escapeHtml(pickup.food_name)}</td>
                  <td>${escapeHtml(pickup.donor_name)}</td>
                  <td>${escapeHtml(pickup.pickup_address)}</td>
                  <td><span class="status">${escapeHtml(pickup.status)}</span></td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }
}

async function updatePickup(id, status) {
  const response = await fetch(`/api/pickups/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      status
    })
  });

  const data = await response.json();
  alert(data.message);

  if (data.success) {
    await loadDashboard();
    await loadPickups();
    await loadDonations();
  }
}