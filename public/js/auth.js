const registerForm = document.getElementById("registerForm");
const loginForm = document.getElementById("loginForm");

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(registerForm);
    const body = Object.fromEntries(formData.entries());

    const response = await fetch("/api/register", {
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

    showMessage("Registration successful. Redirecting to login...");

    setTimeout(() => {
      window.location.href = "/login.html";
    }, 1000);
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(loginForm);
    const body = Object.fromEntries(formData.entries());

    const response = await fetch("/api/login", {
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

    showMessage("Login successful. Opening dashboard...");

    setTimeout(() => {
      window.location.href = "/dashboard.html";
    }, 700);
  });
}