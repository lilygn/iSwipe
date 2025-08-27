import requests
from bs4 import BeautifulSoup
import json

url = "https://siebelschool.illinois.edu/research"
soup = BeautifulSoup(requests.get(url).text, "html.parser")

labs = []

ul_section = soup.find('ul', class_='fa-ul twocol')
for li in ul_section.find_all('li'):
    a_tag = li.find('a')
    if a_tag and a_tag.get('href'):
        labs.append({
            "area": a_tag.text.strip(),
            "url": "https://siebelschool.illinois.edu" + a_tag.get('href')
        })

with open("research_links.json", "w") as f:
    json.dump(labs, f, indent=2)

print("Saved", len(labs), "research area links.")


