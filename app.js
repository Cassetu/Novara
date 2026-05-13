document.addEventListener("DOMContentLoaded", async () => {

    console.log("Js loaded");

    const viewLanding = document.getElementById("view-landing");
    const authView = document.getElementById("view-auth");
    const appView = document.getElementById("app-view");
    const viewPublicCourses = document.getElementById("view-public-courses");

    const btnLandingCourses = document.getElementById("btn-landing-courses");
    const btnLandingSignin = document.getElementById("btn-landing-signin");
    const btnBackLanding = document.getElementById("btn-back-landing");
    const heroCta = document.querySelector(".hero-cta");

    const authMagicBtn = document.getElementById("auth-magic-btn");
    const emailInput = document.getElementById("auth-email-input");
    const messageBox = document.getElementById("auth-status");

    console.log("DOM elements identified");

    if (btnLandingSignin) {
        btnLandingSignin.addEventListener("click", (e) => {
            e.preventDefault();
            viewLanding.style.display = "none";
            authView.style.display = "block";
        });
    }

    const openPublicCatalog = (e) => {
        e.preventDefault();
        viewLanding.style.display = "none";
        viewPublicCourses.style.display = "block";
    };
    if (btnLandingCourses) btnLandingCourses.addEventListener("click", openPublicCatalog);
    if (heroCta) heroCta.addEventListener("click", openPublicCatalog);

    if (btnBackLanding) {
        btnBackLanding.addEventListener("click", () => {
            viewPublicCourses.style.display = "none";
            viewLanding.style.display = "flex";
        });
    }

    document.querySelectorAll(".public-signin-trigger").forEach(btn => {
        btn.addEventListener("click", () => {
            viewPublicCourses.style.display = "none";
            authView.style.display = "block";
        });
    });


    window.firebaseAuth.onAuthStateChanged((user) => {
        if (user) {
            viewLanding.style.display = "none";
            viewPublicCourses.style.display = "none";
            authView.style.display = "none";
            appView.style.display = "flex";
            console.log("Welcome back, ", user.email);
        } else {
            viewLanding.style.display = "flex";
            viewPublicCourses.style.display = "none";
            authView.style.display = "none";
            appView.style.display = "none";
        }
    });

    if (window.isSignInWithEmailLink(window.firebaseAuth, window.location.href)) {
        messageBox.style.color = "blue";
        messageBox.innerText = "Confirming your magic link...";

        let email = window.localStorage.getItem('emailForSignIn');
        if (!email) {
            email = window.prompt('Please provide your email for confirmation');
        }

        try {
            await window.signInWithEmailLink(window.firebaseAuth, email, window.location.href);
            window.localStorage.removeItem('emailForSignIn');
        } catch (error) {
            messageBox.style.color = "red";
            messageBox.innerText = `Error: ${error.message}`;
        }
        return;
    }

    authMagicBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();

        if (!email) {
            messageBox.style.color = "red";
            messageBox.innerText = "Please enter an email address.";
            return;
        }

        const actionCodeSettings = {
            url: window.location.href,
            handleCodeInApp: true
        };

        try {
            messageBox.style.color = "blue";
            messageBox.innerText = "Sending magic link...";

            await window.sendSignInLinkToEmail(window.firebaseAuth, email, actionCodeSettings);
            window.localStorage.setItem('emailForSignIn', email);

            messageBox.style.color = "green";
            messageBox.innerText = `Check your inbox! We sent a magic link to ${email}`;
            emailInput.value = "";

        } catch (error) {
            messageBox.style.color = "red";
            messageBox.innerText = `Error: ${error.message}`;
        }
    });
});