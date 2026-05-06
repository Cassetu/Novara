document.addEventListener("DOMContentLoaded", async () => {
    const signupForm = document.getElementById("signup-form");
    const emailInput = document.getElementById("email");
    const messageBox = document.getElementById("message-box");
    const headerText = document.getElementById("header-text");

    // ==========================================
    // PHASE 2: Check if they just clicked the email link
    // ==========================================
    // When the page loads, check if the URL has the special Firebase login token
    if (window.isSignInWithEmailLink(window.firebaseAuth, window.location.href)) {

        // Hide the form, they are logging in!
        signupForm.style.display = "none";
        headerText.innerText = "Authenticating...";
        messageBox.style.color = "blue";
        messageBox.innerText = "Confirming your magic link...";

        // saved email
        let email = window.localStorage.getItem('emailForSignIn');

        // confirm if new device
        if (!email) {
            email = window.prompt('Please provide your email for confirmation');
        }

        try {
            // finish login
            const result = await window.signInWithEmailLink(window.firebaseAuth, email, window.location.href);

            // clear
            window.localStorage.removeItem('emailForSignIn');

            headerText.innerText = "Welcome!";
            messageBox.style.color = "green";
            messageBox.innerText = `Successfully signed in as ${result.user.email}!`;

            // dashboard inplement here

        } catch (error) {
            messageBox.style.color = "red";
            messageBox.innerText = `Error: ${error.message}`;
        }

        return; // Stop the rest of the script from running
    }

    signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = emailInput.value;

        const actionCodeSettings = {
            url: window.location.href, // return
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