#!/usr/bin/env python3
import argparse
from random import randint
from typing import List, Tuple
from time import sleep, process_time
from os import system, name
from copy import deepcopy
from sys import argv
from os.path import abspath


class Playground:
    def __init__(self, bounds: Tuple[int, int], drawchars=None):
        if drawchars is None:
            drawchars = {False: "-", True: "0"}
        rows, columns = bounds
        self.rows = rows
        self.columns = columns
        self.drawchars = drawchars
        self.field: List[List[Cell]] = [[Cell(False, row, col) for col in range(columns)] for row in range(rows)]

    # TODO: clip
    # TODO: paste
    # TODO: overflow bounds

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
            cell = new_filed[cell.row][cell.col]
            if cell.alive:
                if neighbours_len < 2 or neighbours_len > 3:
                    cell.die()
                elif neighbours_len in range(2, 4):
                    # keep alive
                    pass
            elif neighbours_len == 3:
                # cell is dead
                cell.live()

        self.map_to_field(process_cell)

        self.field = new_filed

    @classmethod
    def from_file(cls, path, drawchar=None):
        if drawchar is None:
            drawchar = {"0": True, "-": False}

        field = []
        with open(path, "r") as f:
            lines = [line.strip() for line in f.readlines() if line.strip()]
            rows = len(lines)
            columns = len(lines[0])
            for line in lines:
                if line:
                    # throws a key error if character not in drawchars
                    row = [drawchar[c] for c in line.strip()]
                    # check all lines are of equal length
                    if len(row) != columns:
                        raise ValueError("no. of columns does not match")
                    field.append(row)

        playground = cls((rows, columns))
        playground.load(field)
        return playground

    def load(self, field):
        def process_cell(cell):
            cell.alive = field[cell.row][cell.col]

        self.map_to_field(process_cell)

    def save(self, fpath):
        writable = [[self.drawchars[cell.alive] for cell in row] for row in self.field]
        with open(fpath, "w+") as f:
            for row in writable:
                f.write("".join(row) + "\n")

    def draw(self):
        def process_cell(cell):
            print(self.drawchars[cell.alive], end="")

        def do_after_row(**kwargs):
            print("\n", end="")

        self.map_to_field(process_cell, do_after_row=do_after_row)

    def play(self, i, result=True):
        _i = i
        self.draw()
        while i > 0:
            sleep(0.1)
            clear_shell()
            start = process_time()
            self.update()
            end = process_time()
            self.draw()
            i -= 1
            if result:
                print(f"iteration : {_i - i + 1}, duration : {'%.4gs' % (end - start)}")

    def extend(self, row, col):
        # extend each row by col
        for r in range(self.rows):
            self.field[r].extend([Cell(False, r, self.columns + c) for c in range(col)])

        self.columns += col
        # add new row `row` times
        for r in range(row):
            self.field.append([Cell(False, self.rows + r, c) for c in range(self.columns)])

        self.rows += row

    def shrink(self, row, col):
        # shrink each row by col
        for r in range(self.rows):
            self.field[r] = self.field[r][:-col]

        self.columns -= col
        # shrink field by row
        self.field = self.field[:-row]

        self.rows -= row


class Cell:
    def __init__(self, alive: bool, row: int, col: int):
        self.row = row
        self.col = col
        self.alive = alive

    def __str__(self):
        if self.alive:
            return f"({self.row}, {self.col}) - alive"
        else:
            return f"({self.row}, {self.col}) - dead"

    def die(self):
        self.alive = False

    def live(self):
        self.alive = True

    def neighbours(self, arr: Playground):
        indices = [(self.row + i, self.col + j) for i in range(-1, 2) for j in range(-1, 2)]
        neighbour_list = []
        for row, column in indices:
            if column in range(arr.columns) and row in range(arr.rows):
                #  get cell
                neighbour = arr.field[row][column]
                #  check if alive
                if neighbour.alive and (row, column) != (self.row, self.col):
                    #  add to neighbour_list
                    neighbour_list.append(neighbour)

        return neighbour_list


def clear_shell():
    if name == "nt":
        system("cls")
    else:
        system("printf '\033c'")


def parse_args(parser, args):
    x = parser.parse_args(args)
    fpath = None
    if hasattr(x, "fpath"):
        # file_parser
        fpath = abspath(x.fpath)
        playground = Playground.from_file(fpath)
    else:
        # grid_parser
        playground = Playground((x.rows, x.columns))
        playground.randomize()

    # could be either parsers
    if hasattr(x, "save"):
        # grid_parser
        if not x.save:
            fpath = None
        # file_parser
        elif not fpath:
            fpath = abspath(x.save)

    else:
        #  dont save
        fpath = None

    return playground, x.iterations, fpath


class ErrorCatchingArgumentParser(argparse.ArgumentParser):
    def exit(self, status=0, message=None):
        if status:
            raise Exception(f"Exiting because of an error: {message}")

    def error(self, message):
        self.exit(2, message=message)


def setup_parser():
    usage = """
    \tmain.py [--save <filepath>] <rows> <columns> <iterations>
    \tmain.py [--save] [--livechar <charachter>] [--resize <row> <col>] <filepath> <iterations>
    """
    # TODO: parse resize, draw-characters

    grid_parser = ErrorCatchingArgumentParser(prog="Game of Life", usage=usage)
    grid_parser.add_argument("--save")
    grid_parser.add_argument("rows", type=int)
    grid_parser.add_argument("columns", type=int)
    grid_parser.add_argument("iterations", type=int)

    file_parser = ErrorCatchingArgumentParser(prog="Game of Life", usage=usage)
    file_parser.add_argument("--save", action="store_true")
    file_parser.add_argument("fpath")
    file_parser.add_argument("iterations", type=int)

    return [grid_parser, file_parser]


def main():
    grid_parser, file_parser = setup_parser()
    try:
        playground, iterations, fpath = parse_args(grid_parser, argv[1:])
    except:
        playground, iterations, fpath = parse_args(file_parser, argv[1:])

    playground.play(iterations)
    if fpath:
        playground.save(fpath)


if __name__ == "__main__":
    main()
