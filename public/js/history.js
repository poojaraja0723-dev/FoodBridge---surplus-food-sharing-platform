document.addEventListener("DOMContentLoaded", async () => {
  const userData = await getCurrentUser();

  if (!userData.loggedIn) {
    window.location.href = "/login.html";
    return;
  }

  document.getElementById("historyIntro").textContent =
    `Showing activity for ${userData.user.name}.`;

  await loadDonationHistory(userData.user.role);
  await loadPickupHistory();
});

async function loadDonationHistory(role) {
  const container = document.getElementById("donationHistory");

  if (role !== "donor") {
    container.innerHTML =
      `<div class="empty-state">Donation history is available for donor accounts.</div>`;
    return;
  }

  const response = await fetch("/api/my-donations");
  const data = await response.json();

  if (!data.success || data.donations.length === 0) {
    container.innerHTML =
      `<div class="empty-state">You have not registered any donations.</div>`;
    return;
  }

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Food</th>
          <th>Quantity</th>
          <th>Category</th>
          <th>Expiry</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${data.donations
          .map(
            (donation) => `
              <tr>
                <td>${escapeHtml(donation.food_name)}</td>
                <td>${escapeHtml(donation.quantity)} ${escapeHtml(donation.unit)}</td>
                <td>${escapeHtml(donation.category)}</td>
                <td>${escapeHtml(donation.expiry_time)}</td>
                <td><span class="status">${escapeHtml(donation.status)}</span></td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

async function loadPickupHistory() {
  const response = await fetch("/api/pickups");
  const data = await response.json();
  const container = document.getElementById("pickupHistory");

  if (!data.success || data.pickups.length === 0) {
    container.innerHTML =
      `<div class="empty-state">No pickup requests found.</div>`;
    return;
  }

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Food</th>
          <th>Quantity</th>
          <th>Other person</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${data.pickups
          .map((pickup) => {
            const otherPerson =
              pickup.volunteer_name || pickup.donor_name || "Unknown";

            return `
              <tr>
                <td>${escapeHtml(pickup.food_name)}</td>
                <td>${escapeHtml(pickup.quantity)} ${escapeHtml(pickup.unit)}</td>
                <td>${escapeHtml(otherPerson)}</td>
                <td><span class="status">${escapeHtml(pickup.status)}</span></td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}