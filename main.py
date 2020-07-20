#!/usr/bin/env python3
from random import randint
from typing import List, Tuple
from time import sleep
from os import system
from copy import deepcopy
from sys import argv


class Playground:
    def __init__(self, bounds: Tuple[int, int]):
        columns, rows = bounds
        self.columns = columns
        self.rows = rows
        self.field: List[List[Cell]] = [[Cell(False, (row, col)) for col in range(columns)] for row in range(rows)]

    def randomize(self):
        def process_cell(cell):
            cell.alive = [True, False][randint(0, 1)]

        self.map_to_field(process_cell)

    def map_to_field(self, process_cell, do_before_row=None, do_after_row=None):
        for r, row in enumerate(self.field):
            results = None
            if do_before_row is not None:
                results = do_before_row(row_index=r, row=row)
            for cell in row:
                process_cell(cell)
            if do_after_row is not None:
                do_after_row(row_index=r, row=row, results=results)

    def update(self):
        new_filed = deepcopy(self.field)

        def process_cell(cell):
            neighbours = cell.neighbours(self)
            neighbours_len = len(neighbours)
            cell = new_filed[cell.index[0]][cell.index[1]]
            if cell.alive:
                if neighbours_len < 2:
                    cell.die()
                elif neighbours_len in range(2, 4):
                    # keep alive
                    pass
                elif neighbours_len > 3:
                    cell.die()
            elif neighbours_len == 3:
                # cell is dead
                cell.live()

        self.map_to_field(process_cell)

        self.field = new_filed

    # TODO: Load state
    # TODO: Save state

    def draw(self):
        system("cls")
        chars = {True: "+", False: "-"}

        def process_cell(cell):
            print(chars[cell.alive], end='')

        def do_after_row(**kwargs):
            print("\n", end='')

        self.map_to_field(process_cell, do_after_row=do_after_row)


class Cell:
    def __init__(self, alive: bool, index: Tuple[int, int]):
        self.alive = alive
        self.index = index

    def die(self):
        self.alive = False

    def live(self):
        self.alive = True

    def neighbours(self, arr: Playground):
        indices = [(self.index[0] + i, self.index[1] + j) for i in range(-1, 2) for j in range(-1, 2)]
        neighbour_list = []
        for row, column in indices:
            if column in range(arr.columns) and row in range(arr.rows):
                #  get cell
                neighbour = arr.field[row][column]
                #  check if alive
                if neighbour.alive and (row, column) != self.index:
                    #  add to neighbour_list
                    neighbour_list.append(neighbour)

        return neighbour_list


def main():
    if len(argv) != 4:
        print("Usage main.py <rows> <columns> <iterations>")
        return

    try:
        columns, rows, i = [int(x) for x in argv[1:]]
    except ValueError:
        print("Usage main.py <rows> <columns> <iterations>")
        return

    playground = Playground((columns, rows))
    playground.randomize()
    while i > 0:
        sleep(0.25)
        playground.update()
        playground.draw()
        i -= 1


if __name__ == "__main__":
    main()
