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

            backToTop.classList.add("show");

        } else {

            backToTop.classList.remove("show");

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

(() => {

    function initialiseReviewsCarousel() {

        const carousel = document.querySelector("[data-reviews-carousel]");

        if (!carousel) return;

        const viewport = carousel.querySelector(".reviews-viewport");
        const track = carousel.querySelector(".reviews-track");
        const previousButton = carousel.querySelector("[data-review-prev]");
        const nextButton = carousel.querySelector("[data-review-next]");
        const dotsContainer = carousel.querySelector("[data-review-dots]");

        if (!viewport || !track || !previousButton || !nextButton || !dotsContainer) {

            return;

        }

        const slides = Array.from(track.querySelectorAll(".review-slide"));

        if (slides.length < 2) {

            return;

        }

        const slideCount = slides.length;
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let currentIndex = 1;
        let autoplayTimer;
        let isHovered = false;
        let isFocused = false;
        let touchStartX = 0;
        let touchEndX = 0;

        slides.forEach((slide, index) => {

            slide.setAttribute("role", "group");
            slide.setAttribute("aria-roledescription", "slide");
            slide.setAttribute("aria-label", `Review ${index + 1} of ${slideCount}`);

        });

        const firstClone = slides[0].cloneNode(true);
        const lastClone = slides[slideCount - 1].cloneNode(true);

        firstClone.setAttribute("aria-hidden", "true");
        lastClone.setAttribute("aria-hidden", "true");

        track.append(firstClone);
        track.prepend(lastClone);

        const dots = slides.map((slide, index) => {

            const dot = document.createElement("button");

            dot.className = "reviews-dot";
            dot.type = "button";
            dot.setAttribute("aria-label", `Show review ${index + 1}`);

            dot.addEventListener("click", () => {

                moveTo(index + 1);
                syncAutoplay();

            });

            dotsContainer.append(dot);

            return dot;

        });

        function getActiveIndex() {

            return ((currentIndex - 1) % slideCount + slideCount) % slideCount;

        }

        function updateDots() {

            const activeIndex = getActiveIndex();

            dots.forEach((dot, index) => {

                if (index === activeIndex) {

                    dot.setAttribute("aria-current", "true");

                } else {

                    dot.removeAttribute("aria-current");

                }

            });

        }

        function moveTo(index, instant = false) {

            currentIndex = index;
            track.style.transition = instant ? "none" : "";
            track.style.transform = `translateX(-${currentIndex * 100}%)`;
            updateDots();

            if (instant) {

                requestAnimationFrame(() => {

                    track.style.transition = "";

                });

            }

            if (reduceMotion && !instant) {

                requestAnimationFrame(() => {

                    if (currentIndex === 0) {

                        moveTo(slideCount, true);

                    }

                    if (currentIndex === slideCount + 1) {

                        moveTo(1, true);

                    }

                });

            }

        }

        function showNext() {

            moveTo(currentIndex + 1);

        }

        function showPrevious() {

            moveTo(currentIndex - 1);

        }

        function stopAutoplay() {

            window.clearInterval(autoplayTimer);

        }

        function startAutoplay() {

            if (reduceMotion || isHovered || isFocused || document.hidden) return;

            stopAutoplay();
            autoplayTimer = window.setInterval(showNext, 6000);

        }

        function syncAutoplay() {

            stopAutoplay();
            startAutoplay();

        }

        previousButton.addEventListener("click", () => {

            showPrevious();
            syncAutoplay();

        });

        nextButton.addEventListener("click", () => {

            showNext();
            syncAutoplay();

        });

        track.addEventListener("transitionend", event => {

            if (event.target !== track || event.propertyName !== "transform") return;

            if (currentIndex === 0) {

                moveTo(slideCount, true);

            }

            if (currentIndex === slideCount + 1) {

                moveTo(1, true);

            }

        });

        carousel.addEventListener("mouseenter", () => {

            isHovered = true;
            stopAutoplay();

        });

        carousel.addEventListener("mouseleave", () => {

            isHovered = false;
            syncAutoplay();

        });

        carousel.addEventListener("focusin", () => {

            isFocused = true;
            stopAutoplay();

        });

        carousel.addEventListener("focusout", event => {

            if (!carousel.contains(event.relatedTarget)) {

                isFocused = false;
                syncAutoplay();

            }

        });

        carousel.addEventListener("keydown", event => {

            if (event.key === "ArrowLeft") {

                event.preventDefault();
                showPrevious();
                syncAutoplay();

            }

            if (event.key === "ArrowRight") {

                event.preventDefault();
                showNext();
                syncAutoplay();

            }

        });

        viewport.addEventListener("touchstart", event => {

            touchStartX = event.changedTouches[0].screenX;
            touchEndX = touchStartX;

        }, { passive:true });

        viewport.addEventListener("touchmove", event => {

            touchEndX = event.changedTouches[0].screenX;

        }, { passive:true });

        viewport.addEventListener("touchend", () => {

            const swipeDistance = touchEndX - touchStartX;

            if (Math.abs(swipeDistance) < 50) return;

            if (swipeDistance < 0) {

                showNext();

            } else {

                showPrevious();

            }

            syncAutoplay();

        }, { passive:true });

        document.addEventListener("visibilitychange", syncAutoplay);

        moveTo(1, true);
        startAutoplay();

    }

    if (document.readyState === "loading") {

        document.addEventListener("DOMContentLoaded", initialiseReviewsCarousel);

    } else {

        initialiseReviewsCarousel();

    }

})();
