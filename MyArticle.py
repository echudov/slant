from newspaper import Article
import time

class MyArticle:

    def __init__(self, url):
        self.url = url
        self.article = Article(url)
        self.parsed = False
        self.download_time = None
        self.parse_time = None
        self.text = None
        self.title = None
        self.authors = None
        self.nlp_info = None
        '''
        print("downloading")
        t0 = time.time()
        self.article.download()
        t1 = time.time()
        print(t1-t0)
        print("parsing")
        self.article.parse()
        print(time.time() - t1)
        '''
        # print(self.article.title)
        # print(self.article.authors)
        # print(self.article.text)

    def download_and_parse(self):
        t0 = time.time()
        self.article.download()
        self.download_time = time.time() - t0

        t0 = time.time()
        self.article.parse()
        self.parse_time = time.time() - t0

        self.text = self.article.text
        self.title = self.article.title
        self.authors = self.article.authors
        self.article = None
        self.parsed = True

    def convert_to_json_file(self):
        self.download_and_parse()


    def get_baseline(self):
        # parse from allsides
        # hold data in local file or something
        # need to get author and original source baseline
        print('temp')

    def political_nature(self):
        # determine 2 things:
        # 1: Is this political in the first place
        # 2: Determine how parties/individuals feel about it
        # 2b: possibly try to use some data on how republicans and democrats actually feel
        #     on the issue (i.e. 55% of democrats agreeing = 0.55 modifier rather than 1 or -1)
        print('temp')

    def analyze_sentiment(self):
        print("temp")

if __name__ == '__main__':
    art = MyArticle('https://www.politico.com/news/2020/01/09/tom-steyer-qualifies-democratic-debate-096915')
    art2 = MyArticle('https://www.axios.com/nikki-haley-dylan-roof-hijacked-confederate-flag-c96a474f-3331-49ed-834d-88e5390ad3ef.html')