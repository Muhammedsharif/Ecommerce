// Admin Sidebar Toggle Functionality
document.addEventListener('DOMContentLoaded', function() {
    // Get elements with error checking
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const overlay = document.getElementById('overlay');

    // Debug: Check if elements exist
    console.log('Admin Sidebar JS - Elements found:', {
        menuToggle: !!menuToggle,
        sidebar: !!sidebar,
        mainContent: !!mainContent,
        overlay: !!overlay
    });

    // Ensure all elements exist before proceeding
    if (!menuToggle || !sidebar || !mainContent || !overlay) {
        console.error('Admin Sidebar JS - One or more required elements not found');
        return;
    }

    function toggleSidebar() {
        console.log('Toggle sidebar called, window width:', window.innerWidth);
        
        if (window.innerWidth <= 767) {
            // Mobile mode
            const isVisible = sidebar.classList.contains('visible');
            console.log('Mobile mode, sidebar visible:', isVisible);
            
            if (isVisible) {
                closeSidebar();
            } else {
                openSidebar();
            }
        } else {
            // Desktop mode
            console.log('Desktop mode');
            const isHidden = sidebar.classList.contains('hidden');
            
            if (isHidden) {
                sidebar.classList.remove('hidden');
                mainContent.classList.remove('full-width');
                menuToggle.classList.remove('active');
            } else {
                sidebar.classList.add('hidden');
                mainContent.classList.add('full-width');
                menuToggle.classList.add('active');
            }
        }
    }

    function openSidebar() {
        console.log('Opening sidebar');
        sidebar.classList.add('visible');
        overlay.classList.add('active');
        menuToggle.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeSidebar() {
        console.log('Closing sidebar');
        sidebar.classList.remove('visible');
        overlay.classList.remove('active');
        menuToggle.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Menu toggle button event listener
    if (menuToggle) {
        menuToggle.addEventListener('click', function(e) {
            console.log('Menu toggle clicked');
            e.preventDefault();
            e.stopPropagation();
            toggleSidebar();
        });
    }

    // Close sidebar when clicking overlay
    if (overlay) {
        overlay.addEventListener('click', function(e) {
            console.log('Overlay clicked');
            e.preventDefault();
            closeSidebar();
        });
    }

    // Close sidebar on mobile when clicking outside
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 767 && sidebar.classList.contains('visible')) {
            if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                console.log('Clicked outside sidebar, closing');
                closeSidebar();
            }
        }
    });

    // Handle window resize
    window.addEventListener('resize', function() {
        console.log('Window resized to:', window.innerWidth);
        
        if (window.innerWidth > 767) {
            // Desktop mode - reset mobile states
            sidebar.classList.remove('visible');
            overlay.classList.remove('active');
            menuToggle.classList.remove('active');
            document.body.style.overflow = '';
            
            // Ensure sidebar is visible on desktop
            sidebar.classList.remove('hidden');
            mainContent.classList.remove('full-width');
        } else {
            // Mobile mode - ensure sidebar is hidden initially
            sidebar.classList.remove('visible');
            overlay.classList.remove('active');
            menuToggle.classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    // Touch gestures for mobile
    let touchStartX = 0;
    let touchEndX = 0;

    document.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].screenX;
    });

    document.addEventListener('touchend', function(e) {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    });

    function handleSwipe() {
        if (window.innerWidth <= 767) {
            const swipeThreshold = 50;
            const swipeDistance = touchEndX - touchStartX;
            
            // Swipe right to open sidebar (from left edge)
            if (swipeDistance > swipeThreshold && touchStartX < 50 && !sidebar.classList.contains('visible')) {
                console.log('Swipe right detected, opening sidebar');
                openSidebar();
            }
            // Swipe left to close sidebar
            else if (swipeDistance < -swipeThreshold && sidebar.classList.contains('visible')) {
                console.log('Swipe left detected, closing sidebar');
                closeSidebar();
            }
        }
    }

    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && sidebar.classList.contains('visible')) {
            console.log('Escape key pressed, closing sidebar');
            closeSidebar();
        }
    });

    // Initialize proper state based on screen size
    function initializeSidebar() {
        if (window.innerWidth <= 767) {
            // Mobile: hide sidebar initially
            sidebar.classList.remove('visible');
            overlay.classList.remove('active');
            menuToggle.classList.remove('active');
            document.body.style.overflow = '';
        } else {
            // Desktop: show sidebar
            sidebar.classList.remove('hidden');
            mainContent.classList.remove('full-width');
            menuToggle.classList.remove('active');
        }
    }

    // Initialize sidebar state
    initializeSidebar();

    console.log('Admin Sidebar JavaScript initialized successfully');
});