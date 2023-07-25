import http from "http";
import fileSystem from "fs/promises";
import path from "path";

const hostname = "127.0.0.1";
const port = 8080;

const server = http.createServer(async (req, res) => {
    try {
        res.statusCode = 200;
        
        let filePath;
        if (req.url === "/") {
            filePath = "index.html";
            res.setHeader("Content-Type", "text/html");
        } else {
            const ext = path.extname(req.url);
            filePath = req.url.slice(1);
            if (ext === ".css") {
                res.setHeader("Content-Type", "text/css");
            } else if (ext === ".js" || ext === ".mjs") {
                res.setHeader("Content-Type", "text/javascript");
            }
        }

        let content = await fileSystem.readFile(filePath);
        res.end(content);
    } catch (e) {
        res.statusCode = 404;
        res.end("no");
    }
});

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});