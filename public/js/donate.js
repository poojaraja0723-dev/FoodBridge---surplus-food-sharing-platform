document.addEventListener("DOMContentLoaded", async () => {
  const userData = await getCurrentUser();

  if (!userData.loggedIn) {
    window.location.href = "/login.html";
    return;
  }

  if (userData.user.role !== "donor") {
    showMessage("Only donor accounts can publish food donations.", true);
    document.getElementById("donationForm").style.display = "none";
    return;
  }

  const donationForm = document.getElementById("donationForm");

  donationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(donationForm);
    const body = Object.fromEntries(formData.entries());

    const response = await fetch("/api/donations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!data.success) {
      showMessage(data.message, true);
      return;
    }

    showMessage("Donation published successfully.");
    donationForm.reset();
  });
});