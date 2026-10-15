const axios = require('axios');
const fs = require('fs');
const path = require('path');

const TEST_CASES = [
    {
        name: "Complex Coding Task",
        prompt: "Create a high-performance LRU cache in JavaScript with a custom eviction policy. Include full implementation, complexity analysis, and a test suite. Output should be professional and complete.",
        expected: ["LRU", "Map", "Doubly Linked List", "O(1)", "Time Complexity", "Space Complexity", "class", "test"]
    },
    {
        name: "Nuanced Reasoning",
        prompt: "Explain the difference between Optimistic and Pessimistic locking in distributed databases. Give a real-world scenario for each and compare them in a table. Answer in Hinglish.",
        expected: ["Optimistic", "Pessimistic", "Distributed", "Locking", "Table", "Scenario", "Hinglish"]
    },
    {
        name: "Creative & Detailed Content",
        prompt: "Write a detailed architectural plan for a futuristic city on Mars. Include energy sources, transport systems, and social structure. Use professional formatting with headings.",
        expected: ["Mars", "Energy", "Transport", "Social", "Architecture", "Future", "##"]
    },
    {
        name: "Short Conversational",
        prompt: "Hello AI-Dost, how are you doing today?",
        expected: ["Hello", "AI-Dost", "fine", "good", "Namaste"]
    }
];

async function testModel(model, prompt) {
    try {
        const res = await axios.post('http://localhost:5090/api/chat', {
            message: prompt,
            model: model,
            mode: 'chat',
            history: []
        }, { timeout: 60000 });
        
        console.log(`   Response received from ${model}`);
        return res.data.reply || res.data.message || JSON.stringify(res.data);
    } catch (e) {
        console.error(`   Error calling ${model}: ${e.message}`);
        return `ERROR: ${e.message}`;
    }
}

async function runTests() {
    const modelsToTest = ['auto', 'groq', 'gemini', 'local:qwen2.5-coder:7b'];
    const results = [];

    for (const tc of TEST_CASES) {
        console.log(`\nTesting Case: ${tc.name}`);
        const caseResults = { case: tc.name, prompt: tc.prompt, modelOutputs: {} };

        for (const model of modelsToTest) {
            console.log(`  -> Model: ${model}...`);
            const output = await testModel(model, tc.prompt);
            caseResults.modelOutputs[model] = output;
        }
        results.push(caseResults);
    }

    const reportPath = path.join(__dirname, 'chat_test_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n✅ Tests completed. Report saved to: ${reportPath}`);
}

runTests().catch(console.error);
