$(function () {

    "use strict";

    $(window).scroll(function () {
        if ($(this).scrollTop() > 1) {
            if ($('.main_menu').offset() != undefined) {
                if (!$('.main_menu').hasClass("menu_fix")) {
                    $('.main_menu').addClass("menu_fix");
                }
            }
        }
        else {
            if ($('.main_menu').offset() != undefined) {
                $('.main_menu').removeClass("menu_fix");
            }
        }
    });

    if ($('.banner_main .menu_cat_item').length && $('.banner_main .menu_cat_item').is(':visible')) {
        $('.menu_category_bar').addClass('ratate_arrow');
    }

    $('.menu_category_bar').on('click', function (e) {
        e.stopPropagation();
        const $bannerCat = $('.banner_main .menu_cat_item');
        if ($bannerCat.length && $bannerCat.is(':visible')) {
            $bannerCat.slideToggle(300);
        } else {
            $('.menu_category_area').toggleClass('show_category');
        }
        $('.menu_category_bar').toggleClass('ratate_arrow');
    });

    $(document).on('click', function (e) {
        if (!$(e.target).closest('.menu_category_area').length) {
            $('.menu_category_area').removeClass('show_category');
            $('.menu_category_bar').removeClass('ratate_arrow');
        }
    });

    $('.venobox').venobox();

    const simplyCountdownOne = document.querySelector('.simply-countdown-one');
    if(simplyCountdownOne) {
        const endTime = simplyCountdownOne.getAttribute("data-end-time");
        if (!endTime) return;
        const endDate = new Date(endTime);
        simplyCountdown('.simply-countdown-one', {
            year: endDate.getFullYear(),
            month: endDate.getMonth() + 1,
            day: endDate.getDate(),
            hours: endDate.getHours(),
            minutes: endDate.getMinutes(),
            seconds: endDate.getSeconds(),
            enableUtc: true
        });
    }

    $('.counter').countUp();

    $('.select_js').niceSelect();

    const listSelectJS = document.querySelectorAll("[select-js]");
    if(listSelectJS.length > 0) {
        listSelectJS.forEach(selectJS => {
            const url = new URL(window.location.href);
            const fieldName = selectJS.getAttribute("select-js");

            selectJS.addEventListener("click", (event) => {
                if (event.target.classList.contains("option")) {
                    const value = event.target.getAttribute("data-value");
                    if (value) {
                        url.searchParams.set(fieldName, value);
                    } else {
                        url.searchParams.delete(fieldName);
                    }
                    window.location.href = url.href;
                }
            });

            const currentValue = url.searchParams.get(fieldName);
            if (currentValue) {
                const selectElement = selectJS.querySelector(".select_js");
                if (selectElement) {
                    selectElement.value = currentValue;
                    $(selectElement).niceSelect('update');
                }
            }
        })
    }

    new WOW().init();

    $('.banner_slider').slick({
        slidesToShow: 1,
        slidesToScroll: 1,
        autoplay: false,
        autoplaySpeed: 3000,
        dots: true,
        arrows: false
    });

    // Slick caches the container width at init (before webfonts/images settle),
    // which can leave slides wider than the viewport on mobile. Recalculate
    // dimensions once the page is loaded and whenever the viewport changes.
    let bannerResizeTimer;
    $(window).on('load', function () {
        $('.banner_slider').slick('refresh');
    });
    $(window).on('resize', function () {
        clearTimeout(bannerResizeTimer);
        bannerResizeTimer = setTimeout(function () {
            $('.banner_slider').slick('refresh');
        }, 200);
    });



    // The same class drives the home flash-sale rail and the "Related" /
    // "Viewed" rails on the product page, which often carry fewer items than
    // slidesToShow. With infinite scrolling Slick clones slides to fill the
    // view, which misrenders when slidesToShow >= slideCount, so keep these
    // rails finite and init each one on its own.
    $('.flash_sell_slider').each(function () {
        var $rail = $(this);
        var count = $rail.children().length;
        if (count === 0) return;
        // 4 or fewer items fit in one row — render as a plain grid (class hook
        // for CSS) instead of a slider, so the cards match the other product
        // grids exactly.
        if (count <= 4) { $rail.addClass('is-static-grid'); return; }

        $rail.slick({
            slidesToShow: 4,
            slidesToScroll: 1,
            autoplay: false,
            autoplaySpeed: 3000,
            dots: false,
            arrows: true,
            infinite: false,
            nextArrow: '<i class="fas fa-arrow-right nextArrow"></i>',
            prevArrow: '<i class="fas fa-arrow-left prevArrow"></i>',

            responsive: [
                {
                    breakpoint: 1200,
                    settings: {
                        slidesToShow: 3,
                    }
                },
                {
                    breakpoint: 992,
                    settings: {
                        slidesToShow: 3,
                    }
                },
                {
                    breakpoint: 768,
                    settings: {
                        slidesToShow: 2,
                        arrows: false
                    }
                },
                {
                    breakpoint: 576,
                    settings: {
                        slidesToShow: 2,
                    }
                }
            ]
        });
    });



    $('.product_tabs').pwstabs({
        effect: 'slidedown',
        defaultTab: 1,
    });


    if ($('.category_slider').children().length > 5) {
        $('.category_slider').slick({
            slidesToShow: 8,
            slidesToScroll: 1,
            autoplay: true,
            autoplaySpeed: 2500,
            dots: false,
            arrows: true,
            nextArrow: '<i class="fas fa-arrow-right nextArrow"></i>',
            prevArrow: '<i class="fas fa-arrow-left prevArrow"></i>',

            responsive: [
                {
                    breakpoint: 1600,
                    settings: {
                        slidesToShow: 7,
                    }
                },
                {
                    breakpoint: 1400,
                    settings: {
                        slidesToShow: 6,
                    }
                },
                {
                    breakpoint: 1200,
                    settings: {
                        slidesToShow: 5,
                    }
                },
                {
                    breakpoint: 992,
                    settings: {
                        slidesToShow: 4,
                    }
                },
                {
                    breakpoint: 768,
                    settings: {
                        slidesToShow: 3,
                    }
                },
                {
                    breakpoint: 576,
                    settings: {
                        slidesToShow: 2,
                    }
                }
            ]
        });
    } else {
        $('.category_slider').addClass('d-flex justify-content-center flex-wrap').removeClass('row');
        $('.category_slider').children().css({
            'flex': '0 0 auto',
            'width': '170px',
            'margin': '0 20px'
        });
    }

    if ($('.favourite_product_slider').children().length > 5) {
        $('.favourite_product_slider').slick({
            slidesToShow: 5,
            slidesToScroll: 1,
            autoplay: true,
            autoplaySpeed: 2500,
            dots: false,
            arrows: true,
            nextArrow: '<i class="fas fa-arrow-right nextArrow"></i>',
            prevArrow: '<i class="fas fa-arrow-left prevArrow"></i>',

            responsive: [
                {
                    breakpoint: 1400,
                    settings: {
                        slidesToShow: 4,
                    }
                },
                {
                    breakpoint: 1200,
                    settings: {
                        slidesToShow: 3,
                    }
                },
                {
                    breakpoint: 992,
                    settings: {
                        slidesToShow: 3,
                    }
                },
                {
                    breakpoint: 768,
                    settings: {
                        slidesToShow: 2,
                        arrows: false
                    }
                },
                {
                    breakpoint: 576,
                    settings: {
                        slidesToShow: 2,
                    }
                }
            ]
        });
    }

    $("#sticky_sidebar_shop").stickit({
        top: 70,
        screenMinWidth: 1400,
    });


    const initPriceRangeSlider = () => {
        const rangeSlider = document.querySelector(".range_slider");
        if(!rangeSlider) return;

        $(rangeSlider).empty();

        const url = new URL(window.location.href);

        const currentCurrency = (window.currencyState && window.currencyState.current)
            || localStorage.getItem("currency")
            || "VND";

        let rate = 1;
        if (currentCurrency !== "VND") {
            const rates = (window.currencyConfig && window.currencyConfig.rates) || {};
            if (rates[currentCurrency]) {
                rate = rates[currentCurrency];
            } else {
                try {
                    const cached = JSON.parse(localStorage.getItem("currencyRates") || "{}");
                    if (cached.rates && cached.rates[currentCurrency]) {
                        rate = cached.rates[currentCurrency];
                    }
                } catch(e) {}
            }
        }

        // The slider always operates in VND: fixed min/max/step, and the URL
        // `price` param (which the backend filters on `priceNew`, stored in VND)
        // is read and written directly with no rate math. Only the label text is
        // converted to the viewer's currency, so switching currency never rounds
        // the range, shifts the max, or drifts the param across round-trips.
        const MIN_VND = 0;
        const MAX_VND = 50000000;
        const STEP_VND = 10000;

        // Compact currency notation ("$2K", "₫50M", "€1.9K") keeps both end
        // labels a similar short width in every currency, so the track spacing
        // stays stable when the viewer switches currency.
        let currencyFormatter;
        try {
            currencyFormatter = new Intl.NumberFormat("en-US", {
                notation: "compact",
                style: "currency",
                currency: currentCurrency,
                maximumFractionDigits: 1
            });
        } catch (e) {
            currencyFormatter = new Intl.NumberFormat("en-US", { notation: "compact" });
        }
        const prettifyFn = (number) => currencyFormatter.format(Math.round(Number(number) * rate));

        const initialSelectedValues = {
            from: MIN_VND,
            to: MAX_VND
        };

        const valueCurrent = url.searchParams.get("price");
        if(valueCurrent) {
            const [fromVnd, toVnd] = valueCurrent.split("-").map(Number);
            if (!isNaN(fromVnd)) {
                initialSelectedValues.from = Math.min(MAX_VND, Math.max(MIN_VND, fromVnd));
            }
            if (!isNaN(toVnd)) {
                initialSelectedValues.to = Math.min(MAX_VND, Math.max(MIN_VND, toVnd));
            }
        }

        const options = {
            range: {
                min: MIN_VND,
                max: MAX_VND,
                step: STEP_VND
            },
            initialSelectedValues: initialSelectedValues,
            prettify: prettifyFn,
            onFinish: (values) => {
                const fromSelected = Math.round(Number(values.selectedValues.from));
                const toSelected = Math.round(Number(values.selectedValues.to));

                if (fromSelected <= MIN_VND && toSelected >= MAX_VND) {
                    url.searchParams.delete("price");
                } else {
                    url.searchParams.set("price", `${fromSelected}-${toSelected}`);
                }
                window.location.href = url.href;
            }
        };

        $('.range_slider').alRangeSlider(options);
        $('.range_slider').find('input[name="from"]').attr('aria-label', 'Minimum price');
        $('.range_slider').find('input[name="to"]').attr('aria-label', 'Maximum price');
    };

    window.initPriceRangeSlider = initPriceRangeSlider;
    initPriceRangeSlider();




    $(".shop_filter_btn").on("click", function () {
        $(".shop_filter_btn").toggleClass("show");
    });
    $(".shop_filter_btn").on("click", function () {
        $(".shop_filter_area").toggleClass("show");
    });

    $('.details_slider_thumb').slick({
        slidesToShow: 1,
        slidesToScroll: 1,
        arrows: false,
        vertical: true,
        asNavFor: '.details_slider_nav',
    });
    $('.details_slider_nav').slick({
        slidesToShow: 5,
        slidesToScroll: 1,
        asNavFor: '.details_slider_thumb',
        autoplay: false,
        autoplaySpeed: 3000,
        dots: false,
        arrows: false,
        centerMode: true,
        centerPadding: '0',
        focusOnSelect: true,
        vertical: true,

        responsive: [
            {
                breakpoint: 1200,
                settings: {
                    slidesToShow: 3,
                }
            },
            {
                breakpoint: 768,
                settings: {
                    slidesToShow: 5,
                    vertical: false,
                }
            },
            {
                breakpoint: 576,
                settings: {
                    slidesToShow: 3,
                    vertical: false,
                }
            }
        ]
    });

    const stars = document.querySelectorAll(".select_rating i");

    stars.forEach((star, index1) => {
        star.addEventListener("click", () => {
            stars.forEach((star, index2) => {
                index1 >= index2 ? star.classList.add("active") : star.classList.remove("active");
            });
        });
    });

    const mobile_menu = document.querySelectorAll(".mobile_dropdown");
    mobile_menu.forEach((dropdown) => {
        const innerMenu = dropdown.querySelector(".inner_menu");
        if (!innerMenu) return;

        dropdown.addEventListener("click", (e) => {

            if (e.target.closest(".inner_menu")) return;

            if (innerMenu.style.maxHeight) {
                innerMenu.style.maxHeight = null;
                dropdown.classList.remove("active");
            } else {

                mobile_menu.forEach((item) => {
                    const menu = item.querySelector(".inner_menu");
                    if (menu && menu !== innerMenu) {
                        menu.style.maxHeight = null;
                        item.classList.remove("active");
                    }
                });
                innerMenu.style.maxHeight = innerMenu.scrollHeight + "px";
                dropdown.classList.add("active");
            }
        });
    });

    $('.gallery').miv({ image: '.cam', video: '.vid' });

    $(document).on('click', '.password-toggle', function () {
        const $input = $(this).closest('.password-input-wrapper').find('input');
        const $icon = $(this).find('i');
        if ($input.attr('type') === 'password') {
            $input.attr('type', 'text');
            $icon.removeClass('fa-eye').addClass('fa-eye-slash');
            $(this).attr('aria-label', 'Hide password');
        } else {
            $input.attr('type', 'password');
            $icon.removeClass('fa-eye-slash').addClass('fa-eye');
            $(this).attr('aria-label', 'Show password');
        }
    });

});
