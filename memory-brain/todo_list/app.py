import tkinter as tk
from tkinter import messagebox

class TodoList:
    def __init__(self):
        self.tasks = {}
        self.root = tk.Tk()
        self.root.title('Todo List')
        self.task_list = tk.Listbox(self.root)
        self.task_list.pack(padx=10, pady=10)
        self.task_input = tk.Entry(self.root)
        self.task_input.pack(padx=10, pady=10)
        self.add_task_button = tk.Button(self.root, text='Add Task', command=self.add_task)
        self.add_task_button.pack(padx=10, pady=10)

    def add_task(self):
        task = self.task_input.get()
        if task:
            self.tasks[task] = False
            self.task_list.insert(tk.END, task)
            self.task_input.delete(0, tk.END)
        else:
            messagebox.showerror('Error', 'Please enter a task')

    def run(self):
        self.root.mainloop()

if __name__ == '__main__':
    todo_list = TodoList()
    todo_list.run()
