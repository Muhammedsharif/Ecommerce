// Test sorting logic
const testProducts = [
    { productName: "Product A", calculatedLowestPrice: 100 },
    { productName: "Product B", calculatedLowestPrice: 50 },
    { productName: "Product C", calculatedLowestPrice: 200 },
    { productName: "Product D", calculatedLowestPrice: 75 }
];

console.log("Original products:", testProducts);

// Test price ascending
const priceAsc = [...testProducts].sort((a, b) => a.calculatedLowestPrice - b.calculatedLowestPrice);
console.log("Price ascending:", priceAsc);

// Test price descending  
const priceDesc = [...testProducts].sort((a, b) => b.calculatedLowestPrice - a.calculatedLowestPrice);
console.log("Price descending:", priceDesc);