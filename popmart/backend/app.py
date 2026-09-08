import os
from flask import Flask,send_from_directory,jsonify
import csv

app = Flask(__name__)

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","frontend")
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","data")


def read_csv(filename):
    """ 读取csv文件并且返回字典列表"""
    filepath = os.path.join(DATA_DIR,filename)
    try:
        rows = []
        with open(filepath,'r',encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                rows.append(row)
        return rows
    except Exception:
        return []


@app.route('/')
def index():
    return send_from_directory(FRONTEND_DIR,'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory(FRONTEND_DIR,filename)

@app.route('/api/hotsearch')
def hotsearch():
    return jsonify(read_csv('hotsearch_trending.csv'))

@app.route('/api/comments')
def comments():
    return jsonify(read_csv('comments.csv'))

@app.route('/api/ip-performance')
def ip_performance():
    return jsonify(read_csv('ip_performance.csv'))

@app.route('/api/platform-distribution')
def platform_distribution():
    return jsonify(read_csv('platform_distribution.csv'))

@app.route('/api/sentiment')
def sentiment():
    return jsonify(read_csv('sentiment_analysis.csv'))

@app.route('/api/demographics')
def demographics():
    return jsonify(read_csv('user_demographics.csv'))


if __name__ == "__main__":
    app.run(debug=True,port=5000)