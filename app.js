document.addEventListener("DOMContentLoaded", async () => {
    const authView = document.getElementById("auth-view");
    const appView = document.getElementById("app-view");
    const signupForm = document.getElementById("auth-form");
    const emailInput = document.getElementById("email");
    const messageBox = document.getElementById("message");
    window.firebaseAuth.onAuthStateChanged((user) => {
        if (user) {
            authView.style.display = "none";
            appView.style.display = "flex";
            console.log("Welcome back, ", user.email);
        } else {
            authView.style.display = "flex";
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

    signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = emailInput.value;

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
            signupForm.reset();

        } catch (error) {
            messageBox.style.color = "red";
            messageBox.innerText = `Error: ${error.message}`;
        }
    });
});