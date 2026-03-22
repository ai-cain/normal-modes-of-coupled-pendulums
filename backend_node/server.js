import express from 'express';
import { WebSocketServer } from 'ws';
import { execFile } from 'child_process';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

const port = process.env.PORT || 3001;

// Base path to the C++ executable
// Resolves to engine_cpp/build/Release/pendulum_cli.exe depending on where backend is run
const enginePath = path.resolve(__dirname, '../engine_cpp/build/Release/pendulum_cli.exe');

const server = app.listen(port, () => {
    console.log(`Node API Server listening on port ${port}`);
    console.log(`C++ Engine Path: ${enginePath}`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket.');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            const n = data.n || 4;
            const g = data.g || 9.8;
            
            let lengths = data.lengths;
            if (!lengths || !Array.isArray(lengths) || lengths.length !== n) {
                lengths = Array(n).fill(1.12 / n);
            }

            const args = [n.toString(), g.toString(), ...lengths.map(l => l.toString())];

            // Call the C++ Engine securely without spawning a full shell
            execFile(enginePath, args, (error, stdout, stderr) => {
                if (error) {
                    console.error('Engine error:', error);
                    ws.send(JSON.stringify({ error: 'C++ Engine failed to compute modes.' }));
                    return;
                }
                
                try {
                    const resultJson = JSON.parse(stdout);
                    ws.send(JSON.stringify({ type: 'modes_result', data: resultJson }));
                } catch (parseError) {
                    console.error('Failed to parse C++ stdout:', stdout);
                    ws.send(JSON.stringify({ error: 'Invalid output from C++ Engine.' }));
                }
            });
        } catch (e) {
            console.error('Invalid message format:', message);
            ws.send(JSON.stringify({ error: 'Invalid message format. Send JSON.' }));
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected.');
    });
});
