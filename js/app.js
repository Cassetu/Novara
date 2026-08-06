document.addEventListener("DOMContentLoaded", async () => {

    const viewLanding = document.getElementById("view-landing");
    const authView = document.getElementById("view-auth");
    const appView = document.getElementById("app-view");
    const viewPublicCourses = document.getElementById("view-public-courses");

    const btnBackLanding = document.getElementById("btn-back-landing");
    const messageBox = document.getElementById("auth-status");

    const openPublicCatalog = (e) => {
        if (e) e.preventDefault();
        history.pushState({}, "", "?view=courses");
        viewLanding.style.display = "none";
        viewPublicCourses.style.display = "block";
    };

    const openSignIn = (e) => {
        if (e) e.preventDefault();
        history.pushState({}, "", "?view=signin");
        viewLanding.style.display = "none";
        authView.style.display = "block";
    };

    document.querySelectorAll(".landing-explore-trigger").forEach(btn => btn.addEventListener("click", openPublicCatalog));
    document.querySelectorAll(".landing-signin-trigger").forEach(btn => btn.addEventListener("click", openSignIn));

    if (btnBackLanding) {
        btnBackLanding.addEventListener("click", (e) => {
            e.preventDefault();
            history.pushState({}, "", window.location.pathname);
            viewPublicCourses.style.display = "none";
            viewLanding.style.display = "flex";
        });
    }

    document.querySelectorAll(".public-signin-trigger").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            history.pushState({}, "", "?view=signin");
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
        } else {
            const params = new URLSearchParams(window.location.search);
            const view = params.get("view");
            viewLanding.style.display = "none";
            viewPublicCourses.style.display = "none";
            authView.style.display = "none";
            appView.style.display = "none";

            if (view === "courses") {
                viewPublicCourses.style.display = "block";
            } else if (view === "signin") {
                authView.style.display = "block";
            } else {
                viewLanding.style.display = "flex";
            }
        }
    });

    if (window.isSignInWithEmailLink(window.firebaseAuth, window.location.href)) {
        messageBox.style.color = "blue";
        messageBox.innerText = "Confirming magic link...";

        let email = window.localStorage.getItem("emailForSignIn");
        if (!email) {
            email = window.prompt("Please enter your email to confirm sign-in:");
        }

        try {
            await window.signInWithEmailLink(window.firebaseAuth, email, window.location.href);
            window.localStorage.removeItem("emailForSignIn");
        } catch (error) {
            messageBox.style.color = "red";
            messageBox.innerText = "Error: " + error.message;
        }
    }
});