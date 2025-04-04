


function showAlert(title, text, icon = "info", redirectUrl = null) {
    Swal.fire({
        title: title,
        text: text,
        icon: info,
        confirmButtonText: "OK",
        customClass: {
            popup: "custom-swal-popup",  // Custom class for the popup
            confirmButton: "custom-ok-button", // Custom class for the OK button
            icon: "custom-icon" // Custom class for the icon
    }
    }).then(() => {
        if (redirectUrl) {
            window.location.href = redirectUrl; // Redirect after clicking OK
        }
    });
}

document.addEventListener("DOMContentLoaded", function () {
    const observer = new MutationObserver(() => {
          const profileIcon = document.getElementById("profileIcon");
          const profileDropdown = document.getElementById("profileDropdown");

          if (profileIcon && profileDropdown) {
                observer.disconnect(); // Stop observing once found

                // Show dropdown on hover
                profileIcon.addEventListener("mouseenter", function () {
                      profileDropdown.style.display = "block";
                });

                // Hide dropdown when mouse leaves both icon and dropdown
                document.addEventListener("mouseover", function (event) {
                      if (!profileIcon.contains(event.target) && !profileDropdown.contains(event.target)) {
                            profileDropdown.style.display = "none";
                      }
                });

                // Clickable profile options (Ensure they exist before adding event listeners)
                document.querySelectorAll(".profile-option").forEach(option => {
                      option.addEventListener("click", function () {
                            profileDropdown.style.display = "none"; // Hide dropdown after click
                      });
                });
          }
    });

    // Observe DOM for changes (only needed if elements are dynamically added)
    observer.observe(document.body, { childList: true, subtree: true });


      

      // Wishlist Button Toggle
      document.querySelectorAll(".wishlist-btn").forEach(button => {
            button.addEventListener("click", () => {
                  button.classList.toggle("active");
                  let icon = button.querySelector("i");
                  icon.classList.toggle("fa-regular");
                  icon.classList.toggle("fa-solid");
            });
      });


      function setupCarousel(sectionId) {
            let scrollContainer = document.querySelector(`#${sectionId} .product-carousel`);
            let leftArrow = document.querySelector(`#${sectionId} .home-arrowLeft`);
            let rightArrow = document.querySelector(`#${sectionId} .home-arrowRight`);

            rightArrow.addEventListener("click", () => {
                  scrollContainer.scrollBy({ left: 300, behavior: "smooth" });
            });

            leftArrow.addEventListener("click", () => {
                  scrollContainer.scrollBy({ left: -300, behavior: "smooth" });
            });
      }

      // Run after all elements are loaded
      setupCarousel("newArrivals");
      setupCarousel("hotDealsSection");
      setupCarousel("related_products");

      
});

document.addEventListener("DOMContentLoaded", function () {
      document.querySelector(".logout-btn").addEventListener("click", function (e) {
          e.preventDefault();
          Swal.fire({
              title: "Are you sure?",
              text: "You will be logged out!",
              icon: "warning",
              showCancelButton: true,
              confirmButtonColor: "#d33",
              cancelButtonColor: "#3085d6",
              confirmButtonText: "Yes, Logout!"
          }).then((result) => {
              if (result.isConfirmed) {
                  fetch("/admin/logout", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "same-origin"
                  })
                  .then(response => response.json())
                  .then(data => {
                      if (data.success) {
                          sessionStorage.clear();
                          localStorage.clear();
                          window.location.replace(data.redirect);
                      } else {
                          Swal.fire("Error", "Logout failed. Try again!", "error");
                      }
                  })
                  .catch(error => {
                      console.error("Error:", error);
                      Swal.fire("Error", "Something went wrong!", "error");
                  });
              }
          });
      });
      history.pushState(null, null, location.href);
      window.onpopstate = function () {
        history.go(1);
      };
  });

  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  document.addEventListener("DOMContentLoaded", () => {
      const currentPath = window.location.pathname;
    
      if (currentPath === "/forgot_password") {
        document.getElementById("loginBtn").addEventListener("click", () => {
          window.location.href = "/login"; // Redirect to login page
        });
    
        document.getElementById("registerBtn").addEventListener("click", () => {
          window.location.href = "/register"; // Redirect to register page
        });
      }
      if (currentPath === "/login") {
            document.getElementById("loginBtn").addEventListener("click", () => {
              window.location.href = "/login"; // Redirect to login page
            });
        
            document.getElementById("registerBtn").addEventListener("click", () => {
              window.location.href = "/register"; // Redirect to register page
            });
          }
    });

    document.addEventListener("DOMContentLoaded", function () {
      const cartBtn = document.querySelector(".cart-btn"); // Check class or ID
      const cartBtnRemove =document.querySelector(".cart-btn-remove");
      const couponDiscountValueElem = document.querySelector("#couponDiscount");
      const finalAmountValueElem = document.querySelector("#finalAmount");
  
      if (!cartBtn) {
          console.log("Cart button not found!");
          return;
      }
      if (!couponDiscountValueElem || !finalAmountValueElem) {
          console.log("Coupon or Final Amount element not found!");
          return;
      }
  
      cartBtn.addEventListener("click", resetCoupons);
      cartBtnRemove.addEventListener("click", resetCoupons);
  
      function resetCoupons() {
          let currentFinalAmount = parseFloat(finalAmountValueElem.innerText.replace(/₹|,/g, "")) || 0;
          let appliedDiscount = parseFloat(couponDiscountValueElem.innerText.replace(/₹|,/g, "")) || 0;
  
          let resetAmount = currentFinalAmount + appliedDiscount;
  
          localStorage.removeItem("appliedCoupons");
          localStorage.removeItem("couponDiscountValue");
          localStorage.removeItem("finalAmount");
  
          couponDiscountValueElem.innerText = "0";
          finalAmountValueElem.innerText = resetAmount.toFixed(2);
  
          toggleCouponButtons(false); // Show "Apply Coupon", hide "Select New Coupon"
          console.log("Cart Updated: Coupon reset.");
      }
  
      function toggleCouponButtons(hasCoupon) {
          const applyCouponBtn = document.querySelector("#applyCouponBtn");
          const resetCouponBtn = document.querySelector("#resetCouponBtn");
  
          if (!applyCouponBtn || !resetCouponBtn) {
              console.log("Coupon buttons not found!");
              return;
          }
  
          if (hasCoupon) {
              applyCouponBtn.style.display = "none";
              resetCouponBtn.style.display = "inline-block";
          } else {
              applyCouponBtn.style.display = "inline-block";
              resetCouponBtn.style.display = "none";
          }
      }
  });
  

    
    