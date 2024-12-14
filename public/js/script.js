const uploadForm = document.getElementById('uploadForm');
const responseDiv = document.getElementById('response');
const loadingSpinner = document.getElementById('loadingSpinner');
const productNameInput = document.getElementById('productName');
const previewContainer = document.getElementById('previewContainer');
const descriptionInput = document.getElementById('userDescription');
const sizePriceContainer = document.getElementById('sizePriceContainer');
const addSizePriceButton = document.getElementById('addSizePriceButton');

// Spell-checker functionality
function spellCheckInput() {
    const inputField = document.getElementById('productName');
    const suggestionsBox = document.createElement('div');
    suggestionsBox.classList.add('suggestions-box');
    inputField.parentNode.appendChild(suggestionsBox);

    const dictionary = ['Product', 'Name', 'Sample', 'Example']; // Example word list

    inputField.addEventListener('input', function() {
        const inputText = inputField.value;
        suggestionsBox.innerHTML = '';

        if (inputText.length > 1) {
            const suggestions = dictionary.filter(word => word.toLowerCase().startsWith(inputText.toLowerCase()));

            suggestions.forEach(suggestion => {
                const suggestionItem = document.createElement('div');
                suggestionItem.classList.add('suggestion-item');
                suggestionItem.textContent = suggestion;

                suggestionItem.addEventListener('click', function() {
                    inputField.value = suggestion;
                    suggestionsBox.innerHTML = '';
                });

                suggestionsBox.appendChild(suggestionItem);
            });
        }
    });

    inputField.addEventListener('blur', function() {
        setTimeout(() => (suggestionsBox.innerHTML = ''), 200); // Clear suggestions after blur
    });
}

// Function to handle preview and drag-and-drop
function previewImages() {
    const previewContainer = document.getElementById('previewContainer');
    const files = document.getElementById('images').files;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();

        reader.onload = function(e) {
            const imgWrapper = document.createElement('div'); // Wrap the image and remove icon
            imgWrapper.classList.add('img-wrapper');
            imgWrapper.setAttribute('draggable', 'true'); // Enable dragging

            const imgElement = document.createElement('img');
            imgElement.src = e.target.result;
            imgElement.style.width = '100px';
            imgElement.style.margin = '5px';

            // Create the remove icon
            const removeIcon = document.createElement('span');
            removeIcon.classList.add('remove-icon');
            removeIcon.innerText = 'X';
            removeIcon.onclick = function() {
                previewContainer.removeChild(imgWrapper);
            };

            // Append the image and remove icon to the wrapper
            imgWrapper.appendChild(imgElement);
            imgWrapper.appendChild(removeIcon);

            // Add drag-and-drop event listeners
            imgWrapper.addEventListener('dragstart', handleDragStart);
            imgWrapper.addEventListener('dragover', handleDragOver);
            imgWrapper.addEventListener('drop', handleDrop);

            // Append the wrapper to the preview container
            previewContainer.appendChild(imgWrapper);
        };

        reader.readAsDataURL(file);
    }
}

let draggedElement = null;

function handleDragStart(e) {
    draggedElement = this; // Reference the dragged element
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    e.preventDefault(); // Allow dropping
    e.dataTransfer.dropEffect = 'move';
}

function handleDrop(e) {
    e.preventDefault();
    if (draggedElement && draggedElement !== this) {
        const previewContainer = document.getElementById('previewContainer');
        // Insert the dragged element before the target element
        const allElements = Array.from(previewContainer.children);
        const draggedIndex = allElements.indexOf(draggedElement);
        const targetIndex = allElements.indexOf(this);

        if (draggedIndex > targetIndex) {
            previewContainer.insertBefore(draggedElement, this);
        } else {
            previewContainer.insertBefore(draggedElement, this.nextSibling);
        }
    }
    draggedElement = null;
}

// Add event listener to the "Add Size & Price" button
addSizePriceButton.addEventListener('click', () => {
    const newSizePriceGroup = document.createElement('div');
    newSizePriceGroup.classList.add('size-price-group');

    // Create new size input
    const sizeLabel = document.createElement('label');
    sizeLabel.setAttribute('for', 'size');
    sizeLabel.textContent = 'Size:';
    const sizeInput = document.createElement('input');
    sizeInput.setAttribute('type', 'text');
    sizeInput.setAttribute('name', 'size[]');
    sizeInput.setAttribute('placeholder', 'Enter size');
    sizeInput.required = true;

    // Create new price input
    const priceLabel = document.createElement('label');
    priceLabel.setAttribute('for', 'price');
    priceLabel.textContent = 'Price:';
    const priceInput = document.createElement('input');
    priceInput.setAttribute('type', 'text');
    priceInput.setAttribute('name', 'price[]');
    priceInput.setAttribute('placeholder', 'Enter price');
    priceInput.required = true;

    // Add event listener for real-time price formatting (Append "$ CAD")
    priceInput.addEventListener('input', () => {
        let value = priceInput.value.trim(); // Get the input value

        // Check if the value is a valid number (ignore anything else)
        if (!isNaN(value) && value !== "") {
            priceInput.value = `${value}$ CAD`; // Add "$ CAD" to the number
        } else if (value === "") {
            priceInput.value = ""; // If input is empty, clear it
        }
    });

    // Create remove icon
    const removeIcon = document.createElement('span');
    removeIcon.classList.add('remove-size-price-icon');
    removeIcon.innerHTML = '&#x1F5D1;'; // Trash bin icon
    removeIcon.style.cursor = 'pointer';
    removeIcon.style.marginLeft = '10px';
    removeIcon.style.color = 'red';

    // Add click event listener to remove the size-price group
    removeIcon.addEventListener('click', () => {
        sizePriceContainer.removeChild(newSizePriceGroup); // Remove the size-price group
    });

    // Append the inputs and remove icon to the new size-price group
    newSizePriceGroup.appendChild(sizeLabel);
    newSizePriceGroup.appendChild(sizeInput);
    newSizePriceGroup.appendChild(priceLabel);
    newSizePriceGroup.appendChild(priceInput);
    newSizePriceGroup.appendChild(removeIcon);

    // Append the new group to the container
    sizePriceContainer.appendChild(newSizePriceGroup);
});

// Function to generate description using OpenAI API
async function generateDescription(productName, userDescription, sizeInputs, priceInputs) {
    try {
        const response = await fetch('https://api.openai.com/v1/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer YOUR_OPENAI_API_KEY`, // Replace with your OpenAI API Key
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'text-davinci-003',
                prompt: `Generate a product description for the following product:\n\nProduct Name: ${productName}\nUser Description: ${userDescription}\nSizes: ${sizeInputs.join(', ')}\nPrices: ${priceInputs.join(', ')}\n\nMake it engaging and informative, with a clear call to action.`,
                max_tokens: 150,
            }),
        });

        const data = await response.json();
        return data.choices[0].text.trim(); // Return the generated description
    } catch (error) {
        console.error('Error generating description:', error);
        return 'Could not generate description at this time.';
    }
}

// Handle form submission
uploadForm.addEventListener('submit', async function(event) {
    event.preventDefault();

    // Show loading spinner
    loadingSpinner.style.display = 'block';

    // Collect the data
    const formData = new FormData(uploadForm);
    const productName = formData.get('productName');
    const userDescription = formData.get('userDescription');
    const sizeInputs = formData.getAll('size[]');
    const priceInputs = formData.getAll('price[]');

    // Debug: Log the collected sizes and prices
    console.log('Size Inputs:', sizeInputs);
    console.log('Price Inputs:', priceInputs);

    // Validate if sizes and prices match
    if (sizeInputs.length !== priceInputs.length) {
        alert('Please ensure that the number of sizes and prices are equal.');
        loadingSpinner.style.display = 'none';
        return;
    }

    try {
        // Generate an improved description using OpenAI API, including size and price data
        const improvedDescription = await generateDescription(productName, userDescription, sizeInputs, priceInputs);

        // Append the improved description to the form data
        formData.append('description', improvedDescription);

        // Append size and price data to the formData
        sizeInputs.forEach((size, index) => {
            formData.append('size[]', size);
            formData.append('price[]', priceInputs[index]);
        });

        // Send the form data to the server
        const res = await fetch('/api/images/upload', {
            method: 'POST',
            body: formData
        });

        // Check for a successful response
        if (res.ok) {
            // Parse the response body
            const data = await res.json();

            // Hide the loading spinner
            loadingSpinner.style.display = 'none';

            // Display success message
            document.body.innerHTML = `
                <div class="response-message">
                    <p class="success-message">The product "${productName}" has been uploaded and is now in the line of publish on social media. Thank you!</p>
                    <button class="add-another-btn" onclick="addAnotherProduct()">Add Another Product</button>
                </div>
            `;
        } else {
            // Handle the error if response is not ok
            const data = await res.json(); // Parsing error details
            loadingSpinner.style.display = 'none';
            document.body.innerHTML = `
                <div class="response-message">
                    <p class="error-message">Error: ${data.error}</p>
                </div>
            `;
        }
    } catch (error) {
        // Handle any errors that occur
        loadingSpinner.style.display = 'none';
        console.error("Error:", error);
        alert('An error occurred while uploading the product.');
    }
});

// Reset the form for adding another product
function addAnotherProduct() {
    window.location.reload();
}
