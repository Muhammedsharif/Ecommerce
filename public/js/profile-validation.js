// Enhanced Name Validation for Edit Profile
function validateName(name) {
    const errors = [];
    
    if (!name || name.trim().length < 2) {
        errors.push("Name must be at least 2 characters long");
    } else if (name.trim() !== name) {
        errors.push("Name cannot start or end with spaces");
    } else if (name.includes('/') || name.includes('\\')) {
        errors.push("Name cannot contain slashes (/ or \\)");
    } else if (!/^[a-zA-Z\s]+$/.test(name.trim())) {
        errors.push("Name can only contain letters and spaces");
    } else if (name.trim().length > 50) {
        errors.push("Name cannot exceed 50 characters");
    } else if (/\s{2,}/.test(name.trim())) {
        errors.push("Name cannot contain multiple consecutive spaces");
    }
    
    return errors;
}

// Real-time name validation
document.addEventListener('DOMContentLoaded', function() {
    const nameInput = document.getElementById('nameInput');
    const nameError = document.getElementById('nameError');
    const form = document.getElementById('editProfileForm');

    if (nameInput && nameError) {
        nameInput.addEventListener('input', function() {
            const errors = validateName(this.value);
            
            if (errors.length > 0) {
                nameError.textContent = errors[0];
                nameError.style.display = 'block';
                nameInput.style.borderColor = '#dc3545';
            } else {
                nameError.style.display = 'none';
                nameInput.style.borderColor = '#28a745';
            }
        });

        nameInput.addEventListener('blur', function() {
            if (nameError.style.display === 'none') {
                nameInput.style.borderColor = '#e9ecef';
            }
        });

        // Prevent paste of invalid characters
        nameInput.addEventListener('paste', function(e) {
            setTimeout(() => {
                const errors = validateName(this.value);
                if (errors.length > 0) {
                    nameError.textContent = errors[0];
                    nameError.style.display = 'block';
                    nameInput.style.borderColor = '#dc3545';
                }
            }, 10);
        });

        // Prevent typing invalid characters
        nameInput.addEventListener('keypress', function(e) {
            const char = String.fromCharCode(e.which);
            
            // Prevent slashes
            if (char === '/' || char === '\\') {
                e.preventDefault();
                nameError.textContent = "Slashes (/ or \\) are not allowed";
                nameError.style.display = 'block';
                nameInput.style.borderColor = '#dc3545';
                return false;
            }
            
            // Prevent non-letter, non-space characters
            if (!/[a-zA-Z\s]/.test(char)) {
                e.preventDefault();
                nameError.textContent = "Only letters and spaces are allowed";
                nameError.style.display = 'block';
                nameInput.style.borderColor = '#dc3545';
                return false;
            }
        });
    }

    // Form submission validation
    if (form) {
        form.addEventListener('submit', function(e) {
            const nameValue = nameInput.value;
            const errors = validateName(nameValue);
            
            if (errors.length > 0) {
                e.preventDefault();
                nameError.textContent = errors[0];
                nameError.style.display = 'block';
                nameInput.style.borderColor = '#dc3545';
                nameInput.focus();
                
                // Show toast notification if available
                if (typeof showToast === 'function') {
                    showToast(errors[0], 'error');
                }
                return false;
            }
        });
    }
});