// MOBILE MENU

const menuBtn = document.querySelector(".menu-btn");

if (menuBtn) {

    menuBtn.addEventListener("click", () => {

        document.querySelector(".nav-links").classList.toggle("active");

    });

}


// SEARCH FILTER

const searchInput = document.querySelector(".search-box input");

if (searchInput) {

    searchInput.addEventListener("keyup", () => {

        let filter = searchInput.value.toLowerCase();

        let products = document.querySelectorAll(".product-card");

        products.forEach((product) => {

            let title = product.querySelector("h3").textContent.toLowerCase();

            if (title.includes(filter)) {

                product.style.display = "block";

            } else {

                product.style.display = "none";

            }

        });

    });

}