/*================================================

Home Tech Solutions & Services
main.js
Version 1.0

================================================*/

document.addEventListener("DOMContentLoaded", () => {

    /*==========================================
      HEADER ON SCROLL
    ==========================================*/

    const header = document.querySelector("header");

    function updateHeader() {

        if (window.scrollY > 50) {
            header.classList.add("scrolled");
        } else {
            header.classList.remove("scrolled");
        }

    }

    updateHeader();

    window.addEventListener("scroll", updateHeader);


    /*==========================================
      BACK TO TOP
    ==========================================*/

    const backToTop = document.getElementById("backToTop");

    function toggleBackToTop() {

        if (!backToTop) return;

        if (window.scrollY > 500) {

            backToTop.style.display = "flex";

        } else {

            backToTop.style.display = "none";

        }

    }

    toggleBackToTop();

    window.addEventListener("scroll", toggleBackToTop);

    if (backToTop) {

        backToTop.addEventListener("click", () => {

            window.scrollTo({

                top: 0,

                behavior: "smooth"

            });

        });

    }


    /*==========================================
      ACTIVE MENU
    ==========================================*/

    const sections = document.querySelectorAll("section[id]");
    const navLinks = document.querySelectorAll("nav a");

    function updateMenu() {

        let current = "";

        sections.forEach(section => {

            const top = section.offsetTop - 130;
            const bottom = top + section.offsetHeight;

            if (window.scrollY >= top && window.scrollY < bottom) {

                current = section.id;

            }

        });

        navLinks.forEach(link => {

            link.classList.remove("active");

            if (link.getAttribute("href") === "#" + current) {

                link.classList.add("active");

            }

        });

    }

    updateMenu();

    window.addEventListener("scroll", updateMenu);


    /*==========================================
      FADE UP ANIMATION
    ==========================================*/

    const animated = document.querySelectorAll(

        ".service-card, .project-card, .about-content, .about-image, .contact-card"

    );

    if ("IntersectionObserver" in window) {

        const observer = new IntersectionObserver(entries => {

            entries.forEach(entry => {

                if (entry.isIntersecting) {

                    entry.target.classList.add("fade-up");

                    observer.unobserve(entry.target);

                }

            });

        }, {

            threshold: 0.15

        });

        animated.forEach(item => observer.observe(item));

    }


    /*==========================================
      WHATSAPP WIDGET
    ==========================================*/

    const widget = document.getElementById("whatsappWidget");
    const closeBtn = document.getElementById("closeWhatsapp");

    if (widget) {

        const hidden = localStorage.getItem("whatsappClosed");

        if (hidden !== "true") {

            widget.style.display = "none";

            setTimeout(() => {

                widget.style.display = "block";

            }, 5000);

        } else {

            widget.style.display = "none";

        }

        if (closeBtn) {

            closeBtn.addEventListener("click", () => {

                widget.style.display = "none";

                localStorage.setItem("whatsappClosed", "true");

            });

        }

    }


    /*==========================================
      YEAR
    ==========================================*/

    const year = document.getElementById("year");

    if (year) {

        year.textContent = new Date().getFullYear();

    }

});