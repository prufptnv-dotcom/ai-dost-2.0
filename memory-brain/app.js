// Get the todo list element
const todoList = document.getElementById('todo-list');

// Get the form element
const todoForm = document.getElementById('todo-form');

// Add event listener to the form
todoForm.addEventListener('submit', (e) => {
    // Prevent default form submission
    e.preventDefault();

    // Get the todo input value
    const todoInput = document.getElementById('todo-input').value;

    // Create a new todo item
    const todoItem = document.createElement('li');
    todoItem.textContent = todoInput;

    // Add the todo item to the list
    todoList.appendChild(todoItem);

    // Clear the todo input value
    document.getElementById('todo-input').value = '';
});