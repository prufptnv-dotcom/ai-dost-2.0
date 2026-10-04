const axios = require('axios');
const fs = require('fs');
const path = require('path');

const GOLD_STANDARD_CASES = [
    {
        name: "Advanced Architecture",
        prompt: "Design a globally distributed rate limiter system. Explain the choice of data store, the algorithm (Token Bucket vs Leaky Bucket), and how to handle clock drift across regions. Provide a production-ready implementation in Node.js.",
        criteria: ["Distributed", "Clock Drift", "Token/Leaky Bucket", "Redis/Cassandra", "Production-grade code"]
    },
    {
        name: "Logical Paradox/Reasoning",
        prompt: "If a tree falls in a forest and no one is around to hear it, does it make a sound? Answer this from the perspective of both a physicist and a philosopher. Then, synthesize a conclusion in Hinglish.",
        criteria: ["Physics", "Philosophy", "Synthesis", "Hinglish", "Deep Analysis"]
    },
    {
        name: "Complex Refactoring",
        prompt: "I have a monolithic Express.js app with 50+ routes. I want to migrate to a microservices architecture. Provide a detailed step-by-step migration strategy, including the use of an API Gateway and Event Bus (Kafka).",
        criteria: ["Monolith to Microservices", "API Gateway", "Kafka", "Step-by-step Strategy", "Deployment Plan"]
    },
    {
        name: "Extreme Coding Edge Case",
        prompt: "Write a JavaScript function to detect if a given string is a valid mathematical expression and evaluate it without using eval(). Handle nested parentheses and operator precedence.",
        criteria: ["No eval()", "Operator Precedence", "Nested Parentheses", "Parsing Logic", "Complexity Analysis"]
    },
    {
        name: "Nuanced Creative Writing",
        prompt: "Write a dialogue between Socrates and Elon Musk about the future of Artificial General Intelligence (AGI). The tone should be intellectually rigorous but conversational.",
        criteria: ["Socrates", "Elon Musk", "AGI", "Intellectually Rigorous", "Dialogue Format"]
    }
];

async function testModel(model, prompt) {
    try {
        const res = await axios.post('http://localhost:5090/api/chat', {
            message: prompt,
            model: model,
            mode: 'chat',
            history: []
        }, { timeout: 120000 });
        
        return res.data.reply || res.data.message || "EMPTY_RESPONSE";
    } catch (e) {
        return `ERROR: ${e.message}`;
    }
}

async function runBenchmark() {
    const models = ['auto', 'local:qwen2.5-coder:7b'];
    const report = [];

    for (const tc of GOLD_STANDARD_CASES) {
        console.log(`\n🚀 Benchmarking Case: ${tc.name}`);
        const caseResult = {
            case: tc.name,
            prompt: tc.prompt,
            results: {}
        };

        for (const model of models) {
            console.log(`  -> Testing ${model}...`);
            const output = await testModel(model, tc.prompt);
            
            let score = 0;
            tc.criteria.forEach(crit => {
                if (output.toLowerCase().includes(crit.toLowerCase())) score++;
            });

            caseResult.results[model] = {
                output: output,
                score: `${score}/${tc.criteria.length}`,
                passed: score >= Math.ceil(tc.criteria.length / 2)
            };
        }
        report.push(caseResult);
    }

    const reportPath = path.join(__dirname, 'ai_dost_benchmark_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n✅ Benchmark complete. Report saved to: ${reportPath}`);
}

runBenchmark().catch(console.error);
