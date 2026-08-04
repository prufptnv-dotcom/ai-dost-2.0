from flask import Flask, render_template, request, jsonify
from flask import send_from_directory
import os

app = Flask(__name__, static_folder='', template_folder='')

# In-memory todo list
todos = []

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/style.css')
def style():
    return send_from_directory('.', 'style.css')

@app.route('/app.js')
def script():
    return send_from_directory('.', 'app.js')

@app.route('/todos', methods=['GET', 'POST'])
def manage_todos():
    if request.method == 'POST':
        task = request.json.get('task')
        if task:
            todos.append(task)
        return jsonify({'todos': todos})
    return jsonify({'todos': todos})

if __name__ == '__main__':
    app.run(debug=True)