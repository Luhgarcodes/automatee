require('dotenv').config();
const fs = require('fs');
const { OpenAI } = require('openai');
const puppeteer = require('puppeteer');
const { SYSTEM_PROMPT } = require('./constant');

// Initialize Groq client (OpenAI-compatible)
const groq = new OpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY,
});

// === Dynamic Time Range Libraries (Natural Variability) ===
const timeSets = [
    [ // Set 1
        { start: "10:20 AM", hrs: "2.75" },
        { start: "01:05 PM", hrs: "0.92" },
        { start: "02:00 PM", hrs: "3" },
        { start: "05:00 PM", hrs: "0.33" },
        { start: "05:20 PM", hrs: "3.17" }
    ],
    [ // Set 2
        { start: "10:25 AM", hrs: "2.75" },
        { start: "01:10 PM", hrs: "1" },
        { start: "02:10 PM", hrs: "2.92" },
        { start: "05:05 PM", hrs: "0.33" },
        { start: "05:25 PM", hrs: "3.08" }
    ],
    [ // Set 3
        { start: "10:30 AM", hrs: "2.5" },
        { start: "01:00 PM", hrs: "1" },
        { start: "02:00 PM", hrs: "3" },
        { start: "05:00 PM", hrs: "0.33" },
        { start: "05:20 PM", hrs: "3.25" }
    ]
];

// Randomly select one set for this run (Global Scope)
const selectedTimeSet = timeSets[Math.floor(Math.random() * timeSets.length)];
const totalHoursForDay = selectedTimeSet.reduce((acc, curr) => acc + parseFloat(curr.hrs), 0).toFixed(2);
const totalRows = selectedTimeSet.length;

// === Telegram Helpers (Global Scope - Using Function Hoisting) ===
async function sendTelegramMessage(text) {
    const token = process.env.TELEGRAM_BOT;
    const chatId = process.env.TELEGRAM_BOT_CHAT_ID;
    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: text })
        });
    } catch (err) {
        console.error("⚠️ Telegram message failed:", err.message);
    }
}

async function sendTelegramPhoto(filePath) {
    const token = process.env.TELEGRAM_BOT;
    const chatId = process.env.TELEGRAM_BOT_CHAT_ID;
    try {
        const fileBuffer = fs.readFileSync(filePath);
        const formData = new FormData();
        formData.append('chat_id', chatId);
        formData.append('caption', `✅ Timesheet Automation Complete! (${totalHoursForDay} Hours)\n👤 User: ${process.env.TIMESHEET_USER || 'Raghul G'}\n📊 Task: ${process.env.TIMESHEET_TASK_NAME || 'MindChamps LMS'}`);
        const blob = new Blob([fileBuffer], { type: 'image/png' });
        formData.append('photo', blob, 'timesheet.png');
        await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
            method: 'POST',
            body: formData
        });
    } catch (err) {
        console.error("⚠️ Telegram photo failed:", err.message);
    }
}

const URL = process.env.TIMESHEET_URL;
const email = process.env.TIMESHEET_EMAIL;
const password = process.env.TIMESHEET_PASSWORD;
const projectName = process.env.TIMESHEET_PROJECT; 

// List of possible modules for random selection in EMSS project
const emssModules = [
    "Mailing List", "Tags", "Contacts", "Dashboard", "Whatsapp", 
    "Facebook", "Mass Mailing", "Contact Management", 
    "Survey Management", "Agreement"
];

// Global storage for pre-generated tasks to avoid rate limits
let preGeneratedTasks = {};
let selectedModules = {};

(async () => {
    console.log("Starting browser...");
    const browser = await puppeteer.launch({ 
        headless: process.env.GITHUB_ACTIONS === 'true',
        args: [
            '--start-maximized',
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ],
        defaultViewport: null
    });
    
    const page = await browser.newPage();
    
    // 1. Initial Notification (So you know it's working!)
    await sendTelegramMessage(`🚀 Timesheet Automation Started!\n📊 Target: ${totalHoursForDay} Hours\n🎰 Set: Randomized Time Set #${timeSets.indexOf(selectedTimeSet) + 1}`);

    try {
        console.log(`Navigating to ${URL} ...`);
        await page.goto(URL, { waitUntil: 'networkidle2' });

        console.log("Waiting for form fields...");
        await page.waitForSelector('#basic_email');

        console.log("Entering email...");
        await page.type('#basic_email', email, { delay: 50 });

        console.log("Entering password...");
        await page.type('#basic_password', password, { delay: 50 });

        console.log("Clicking login button...");
        await page.click('button.ant-btn-primary');
        
        console.log("Waiting for the '+' Add button to appear...");
        await page.waitForSelector("button[title='Add']", { visible: true, timeout: 30000 });
        
        await new Promise(r => setTimeout(r, 2000));

        console.log("Clicking the '+' button...");
        await page.$eval("button[title='Add']", el => el.click());
        
        console.log("Waiting for the 'Add Time Log' popup...");
        await page.waitForSelector('.ant-modal-content', { visible: true, timeout: 15000 });
        await new Promise(r => setTimeout(r, 1000));

        console.log("Automation successfully opened the Add popup! Filling out details...");
        
        const preGenerateAITasks = async (modulesToGenerate) => {
            try {
                const systemPrompt = SYSTEM_PROMPT;
                const userPrompt = `Generate unique tasks for these 3 modules: ${modulesToGenerate.join(', ')}. Context: MindChamps LMS, enrollment, or tracking.`;
                
                console.log("🚀 Batch generating AI tasks via Groq (Llama 3.3 70B)...");
                const response = await groq.chat.completions.create({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    temperature: 0.7
                });
                
                const text = response.choices[0].message.content;
                
                modulesToGenerate.forEach(m => {
                    const regex = new RegExp(`${m}:\\s*(.*?)(?=\\s*\\w+:|$)`, 'i');
                    const match = text.match(regex);
                    preGeneratedTasks[m] = match ? match[1].trim() : `${m} changes impl`;
                });
                console.log("✅ AI Tasks ready!");
            } catch (err) {
                console.error("⚠️ AI Batch Generation failed:", err.message);
            }
        };

        const emssRowIndices = [0, 2, 4];
        const requestedModules = [];
        emssRowIndices.forEach(idx => {
            selectedModules[idx] = emssModules[Math.floor(Math.random() * emssModules.length)];
            requestedModules.push(selectedModules[idx]);
        });
        
        await preGenerateAITasks(requestedModules);

        const selectDropdowns = async (rowIndex) => {
            try {
                const projectSelector = `[id='timesheet_data_${rowIndex}_project_id']`;
                console.log(`[Row ${rowIndex + 1}] Waiting for Project box...`);
                
                const dropdown = await page.waitForSelector(`.ant-modal-content ${projectSelector}`, { 
                    visible: true, 
                    timeout: 10000 
                });

                if (!dropdown) throw new Error(`Project dropdown for Row ${rowIndex + 1} not found`);
                
                const isBreakRow = rowIndex === 1 || rowIndex === 3;
                const rowProject = isBreakRow ? "Break" : projectName;
                
                let rowModule = isBreakRow ? "Break" : "";
                if (!isBreakRow) {
                    rowModule = selectedModules[rowIndex];
                    console.log(`[Row ${rowIndex + 1}] Module: ${rowModule}`);
                }

                console.log(`[Row ${rowIndex + 1}] Selecting Project: ${rowProject}...`);
                await dropdown.click();
                await new Promise(r => setTimeout(r, 2000)); 
                
                const optionClicked = await page.evaluate(async (name) => {
                    const options = Array.from(document.querySelectorAll('.ant-select-item-option-content'));
                    // Use exact match for 'Break' to be safe
                    const target = options.find(el => 
                        (el.textContent.trim() === name) && 
                        el.offsetParent !== null
                    );
                    if (target) {
                        target.click();
                        return true;
                    }
                    return false;
                }, rowProject);

                if (!optionClicked) {
                    console.log(`⚠️ Project "${rowProject}" not found exactly, trying backup search/type...`);
                    await dropdown.type(rowProject); 
                    await new Promise(r => setTimeout(r, 1500));
                    await page.keyboard.press('Enter');
                }

                // Increased Settle Time for Backend Refresh (Crucial for CI)
                await new Promise(r => setTimeout(r, 3000)); 

                console.log(`[Row ${rowIndex + 1}] Opening Module dropdown (Target: ${rowModule})...`);
                const moduleDropdown = await page.$(`.ant-modal-content [id='timesheet_data_${rowIndex}_module_id']`);
                if (moduleDropdown) {
                    await moduleDropdown.click();
                    await new Promise(r => setTimeout(r, 1500));
                    
                    const moduleClicked = await page.evaluate((name) => {
                        const options = Array.from(document.querySelectorAll('.ant-select-item-option-content'));
                        const target = options.find(el => 
                            el.textContent.trim() === name && 
                            el.offsetParent !== null
                        );
                        if (target) {
                            target.click();
                            return true;
                        }
                        return false;
                    }, rowModule);
                    
                    if (!moduleClicked) {
                        await page.keyboard.type(rowModule);
                        await new Promise(r => setTimeout(r, 1000));
                        await page.keyboard.press('Enter'); 
                    }
                }
                await new Promise(r => setTimeout(r, 2500)); // Final buffer for Task field transformation
            } catch (err) {
                console.error(`❌ Error in selectDropdowns Row ${rowIndex + 1}:`, err.message);
            }
        };

        const generateAITask = async (moduleName) => {
            if (preGeneratedTasks[moduleName]) return preGeneratedTasks[moduleName];
            try {
                const response = await groq.chat.completions.create({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { role: "system", content: SYSTEM_PROMPT },
                        { role: "user", content: `Generate a brief task log for the module: "${moduleName}". Context: student enrollment, package subscriptions, or program tracking.` }
                    ],
                    temperature: 0.7
                });
                return response.choices[0].message.content.trim().replace(/^"|"$/g, '').replace(/^Task: |^Description: /i, '');
            } catch (err) {
                return `${moduleName} functional changes impl`;
            }
        };

        const fillRowDetails = async (rowIndex) => {
            console.log(`[Row ${rowIndex + 1}] Entering Task and Hours...`);
            
            const taskInput = await page.waitForSelector(`#timesheet_data_${rowIndex}_task`, { visible: true, timeout: 5000 });
            if (taskInput) {
                const isBreakRow = rowIndex === 1 || rowIndex === 3;
                if (isBreakRow) {
                    const taskToSelect = rowIndex === 1 ? 'Lunch Break' : 'Evening Break';
                    console.log(`[Row ${rowIndex + 1}] Selecting ${taskToSelect} from dropdown...`);
                    
                    await taskInput.click();
                    await new Promise(r => setTimeout(r, 2000)); // Wait for dropdown animation
                    const optionClicked = await page.evaluate((task) => {
                        const options = Array.from(document.querySelectorAll('.ant-select-item-option-content'));
                        const target = options.find(el => el.textContent.trim() === task && el.offsetParent !== null);
                        if (target) {
                            target.click();
                            return true;
                        }
                        return false;
                    }, taskToSelect);

                    if (!optionClicked) {
                        console.log(`⚠️ "${taskToSelect}" not found exactly, trying backup type/enter...`);
                        await page.keyboard.type(taskToSelect);
                        await new Promise(r => setTimeout(r, 1200));
                        await page.keyboard.press('Enter');
                    }
                } else {
                    const rowModule = await page.evaluate((idx) => {
                        const selectorItem = document.querySelector(`#timesheet_data_${idx}_module_id`).closest('.ant-select-selector').querySelector('.ant-select-selection-item');
                        return selectorItem ? selectorItem.title : "Dashboard";
                    }, rowIndex);

                    console.log(`[Row ${rowIndex + 1}] Generating AI task description for module "${rowModule}"...`);
                    const aiTask = await generateAITask(rowModule);
                    console.log(`   -> AI Generated Task: ${aiTask}`);
                    await taskInput.click({ clickCount: 3 });
                    await page.keyboard.press('Backspace');
                    await taskInput.type(aiTask, { delay: 10 });
                }
            }

            const schedule = selectedTimeSet[rowIndex];
            if (schedule) {
                console.log(`[Row ${rowIndex + 1}] Entering times: ${schedule.start}`);
                const startSelector = `#timesheet_data_${rowIndex}_time_spent`;
                const startInput = await page.waitForSelector(startSelector, { visible: true, timeout: 5000 });
                
                if (startInput) {
                    console.log(`   -> Typing Start Time: ${schedule.start}`);
                    await startInput.click({ clickCount: 3 });
                    await page.keyboard.press('Backspace');
                    await startInput.type(schedule.start, { delay: 30 });
                    await page.keyboard.press('Tab');
                    await new Promise(r => setTimeout(r, 400));
                    await page.keyboard.press('Tab');
                    await new Promise(r => setTimeout(r, 400));
                    const hrsValue = schedule.hrs;
                    console.log(`   -> Entering value in hours field: ${hrsValue}`);
                    await page.keyboard.type(hrsValue, { delay: 30 });
                    await page.keyboard.press('Tab');
                    await new Promise(r => setTimeout(r, 2000)); // Buffer for UI to process the row hours
                    console.log(`✅ [Row ${rowIndex + 1}] Completed.`);
                }
            }
        };

        const clickAddLog = async (nextRowIndex) => {
            console.log(`\nClicking ADD LOG to prepare Row ${nextRowIndex + 1}...`);
            const getAddBtn = async () => {
                await page.evaluate(() => {
                    const body = document.querySelector('.ant-modal-body');
                    if (body) body.scrollTop = body.scrollHeight;
                });
                await new Promise(r => setTimeout(r, 600));

                return await page.evaluateHandle(() => {
                    const modal = document.querySelector('.ant-modal-content');
                    if (!modal) return null;
                    const buttons = Array.from(modal.querySelectorAll('button.ant-btn-dashed'));
                    return buttons.find(b => b.textContent.includes('Add Log'));
                });
            };

            let addBtn = await getAddBtn();
            if (addBtn && addBtn.asElement()) {
                await addBtn.asElement().click({ force: true });
                await new Promise(r => setTimeout(r, 800)); 
                
                for (let attempt = 0; attempt < 12; attempt++) {
                    console.log(`Waiting for Row ${nextRowIndex + 1} (Attempt ${attempt + 1})...`);
                    const found = await page.waitForSelector(`#timesheet_data_${nextRowIndex}_project_id`, { 
                        visible: true, 
                        timeout: 5000 
                    }).catch(() => null);

                    if (found) {
                        await new Promise(r => setTimeout(r, 1000));
                        return;
                    }
                    
                    if (attempt > 0 && attempt % 3 === 0) {
                        console.log("⚠️ Row initialization stuck. Refreshing modal state...");
                        const cancelBtn = await page.$('button[type="button"].ant-btn:not(.ant-btn-primary)'); 
                        if (cancelBtn) {
                            await cancelBtn.click();
                            await new Promise(r => setTimeout(r, 4000)); 
                            addBtn = await getAddBtn();
                            if (addBtn) {
                                await addBtn.asElement().click({ force: true });
                            }
                            await new Promise(r => setTimeout(r, 4000)); 
                        }
                        continue;
                    }

                    await page.keyboard.press('Tab'); 
                    await new Promise(r => setTimeout(r, 2000));
                    addBtn = await getAddBtn();
                    if (addBtn && addBtn.asElement()) {
                        await addBtn.asElement().click({ force: true });
                        await new Promise(r => setTimeout(r, 3000));
                    }
                }
                throw new Error(`Failed to initialize Row ${nextRowIndex + 1} after multiple attempts.`);
            }
        };

        console.log(`\n--- Filling ${totalRows} rows sequentially ---`);
        for (let rowIndex = 0; rowIndex < totalRows; rowIndex++) {
            console.log(`\n=== Processing Row ${rowIndex + 1} ===`);
            await selectDropdowns(rowIndex);
            await fillRowDetails(rowIndex);
            if (rowIndex < totalRows - 1) {
                await clickAddLog(rowIndex + 1);
            }
        }

        console.log("✅ Automation completed! Please review the form and click 'Save' manually.");

        try {
            console.log("📸 Taking success screenshot for Telegram...");
            await new Promise(r => setTimeout(r, 3000));
            const modalSelector = 'div.ant-modal-content'; 
            const modal = await page.waitForSelector(modalSelector, { visible: true, timeout: 5000 });

            if (modal) {
                const snapshotPath = 'timesheet_snapshot.png';
                await modal.screenshot({ path: snapshotPath });
                console.log(`✅ Screenshot saved: ${snapshotPath}`);
                await sendTelegramPhoto(snapshotPath);
                console.log("✅ Telegram notification sent successfully!");
                if (fs.existsSync(snapshotPath)) {
                    fs.unlinkSync(snapshotPath);
                }
            }
        } catch (err) {
            console.error("⚠️ Telegram notification failed:", err.message);
        }

    } catch (error) {
        console.error("An error occurred:", error);
    }
})();